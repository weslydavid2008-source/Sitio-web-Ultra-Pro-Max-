<?php
session_start();

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");

require_once "conexion.php";

$method = $_SERVER["REQUEST_METHOD"] ?? "";
$input = json_decode(file_get_contents("php://input"), true);

if ($method !== "POST") {
    responder(["ok" => false, "mensaje" => "Método no permitido."], 405);
}

if (!is_array($input)) {
    responder(["ok" => false, "mensaje" => "JSON inválido."], 400);
}

$accion = $input["accion"] ?? "";

if ($accion === "solicitar_otp_registro") {
    solicitarOtpRegistro($pdo, $input);
}

if ($accion === "verificar_otp_registro") {
    verificarOtpRegistro($pdo, $input);
}

responder(["ok" => false, "mensaje" => "Acción no permitida."], 405);

function solicitarOtpRegistro(PDO $pdo, array $input): void {
    $correoDestino = normalizarCorreo($input["correo"] ?? "");

    validarCorreoUnico($correoDestino);

    try {
        // SOLO se consulta Usuarios para saber si ese correo exacto ya existe.
        // No se trae ninguna lista de correos.
        $stmtExiste = $pdo->prepare("
            SELECT COUNT(*) AS total
            FROM Usuarios
            WHERE LOWER(TRIM(correo)) = :correo
        ");

        $stmtExiste->execute([":correo" => $correoDestino]);
        $total = (int)($stmtExiste->fetch(PDO::FETCH_ASSOC)["total"] ?? 0);

        if ($total > 0) {
            responder([
                "ok" => false,
                "mensaje" => "Este correo ya está registrado."
            ], 400);
        }

        $codigo = (string) random_int(100000, 999999);
        $fechaExpiracion = date("Y-m-d H:i:s", strtotime("+10 minutes"));

        $pdo->beginTransaction();

        $stmtInvalidar = $pdo->prepare("
            UPDATE RegistroCorreoOtps
            SET usado = 1
            WHERE correo = :correo
              AND usado = 0
        ");
        $stmtInvalidar->execute([":correo" => $correoDestino]);

        $stmtInsert = $pdo->prepare("
            INSERT INTO RegistroCorreoOtps (
                correo,
                codigo,
                fecha_expiracion,
                usado,
                intentos
            ) VALUES (
                :correo,
                :codigo,
                :fecha_expiracion,
                0,
                0
            )
        ");
        $stmtInsert->execute([
            ":correo" => $correoDestino,
            ":codigo" => $codigo,
            ":fecha_expiracion" => $fechaExpiracion
        ]);

        $pdo->commit();

        $resultadoCorreo = enviarCorreoOtpRegistroUnico($correoDestino, $codigo);

        $respuesta = [
            "ok" => true,
            "mensaje" => $resultadoCorreo["enviado"]
                ? "Te enviamos un código a tu correo."
                : "Código generado, pero no se pudo enviar el correo.",
            "correo" => $correoDestino,
            "destinatario_unico" => $correoDestino,
            "destinatarios_detectados" => $resultadoCorreo["destinatarios_detectados"] ?? [$correoDestino],
            "expira_en_minutos" => 10
        ];

        if (!$resultadoCorreo["enviado"]) {
            $respuesta["codigo_prueba"] = $codigo;
            $respuesta["error_correo"] = $resultadoCorreo["error"];
        }

        responder($respuesta);

    } catch (Throwable $error) {
        rollbackSeguro($pdo);
        responder([
            "ok" => false,
            "mensaje" => "Error solicitando código: " . $error->getMessage()
        ], 500);
    }
}

function verificarOtpRegistro(PDO $pdo, array $input): void {
    $correo = normalizarCorreo($input["correo"] ?? "");
    $codigo = trim((string)($input["codigo"] ?? ""));

    validarCorreoUnico($correo);

    if ($codigo === "") {
        responder(["ok" => false, "mensaje" => "El código es obligatorio."], 400);
    }

    try {
        $otp = obtenerOtpRegistroValido($pdo, $correo, $codigo);

        if (!$otp) {
            responder([
                "ok" => false,
                "mensaje" => "Código incorrecto, vencido o ya usado."
            ], 400);
        }

        responder([
            "ok" => true,
            "mensaje" => "Correo verificado correctamente.",
            "correo" => $correo
        ]);

    } catch (Throwable $error) {
        responder([
            "ok" => false,
            "mensaje" => "Error verificando código: " . $error->getMessage()
        ], 500);
    }
}

function enviarCorreoOtpRegistroUnico(string $correoDestino, string $codigo): array {
    $autoloadPath = __DIR__ . "/../vendor/autoload.php";
    $configPath = __DIR__ . "/mail_config.php";

    if (!file_exists($autoloadPath)) {
        return ["enviado" => false, "error" => "No existe vendor/autoload.php.", "destinatarios_detectados" => [$correoDestino]];
    }

    if (!file_exists($configPath)) {
        return ["enviado" => false, "error" => "No existe api/mail_config.php.", "destinatarios_detectados" => [$correoDestino]];
    }

    require_once $autoloadPath;
    $config = require $configPath;

    try {
        $mail = new PHPMailer\PHPMailer\PHPMailer(true);

        $mail->isSMTP();
        $mail->Host = trim((string)$config["host"]);
        $mail->SMTPAuth = true;
        $mail->Username = trim((string)$config["username"]);
        $mail->Password = trim((string)$config["password"]);
        $mail->Port = (int)$config["port"];
        $mail->SMTPKeepAlive = false;

        $smtpSecure = strtolower(trim((string)($config["smtp_secure"] ?? "")));
        if ($smtpSecure === "tls") {
            $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        } elseif ($smtpSecure === "ssl") {
            $mail->SMTPSecure = PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
        }

        $mail->CharSet = "UTF-8";
        $mail->clearAllRecipients();
        $mail->clearAddresses();
        $mail->clearCCs();
        $mail->clearBCCs();
        $mail->clearReplyTos();

        $mail->setFrom(trim((string)$config["from_email"]), trim((string)$config["from_name"]));

        // PUNTO CRÍTICO: un solo destinatario, el correo que llegó del formulario.
        $mail->addAddress($correoDestino, $correoDestino);

        $toAddresses = $mail->getToAddresses();
        $ccAddresses = $mail->getCcAddresses();
        $bccAddresses = $mail->getBccAddresses();

        $destinatariosDetectados = array_map(function($item) {
            return $item[0] ?? "";
        }, $toAddresses);

        // Si por cualquier razón PHPMailer tiene más de un destinatario, se cancela el envío.
        if (count($toAddresses) !== 1 || count($ccAddresses) !== 0 || count($bccAddresses) !== 0) {
            registrarLogOtp($correoDestino, false, "Bloqueado: destinatarios no válidos", $destinatariosDetectados);
            return [
                "enviado" => false,
                "error" => "Bloqueado: el correo tenía más de un destinatario.",
                "destinatarios_detectados" => $destinatariosDetectados
            ];
        }

        if (strtolower(trim($toAddresses[0][0])) !== strtolower(trim($correoDestino))) {
            registrarLogOtp($correoDestino, false, "Bloqueado: destinatario diferente", $destinatariosDetectados);
            return [
                "enviado" => false,
                "error" => "Bloqueado: el destinatario no coincide con el correo escrito.",
                "destinatarios_detectados" => $destinatariosDetectados
            ];
        }

        $mail->isHTML(true);
        $mail->Subject = "Verifica tu correo - Store Super Joven";
        $mail->Body = "
            <div style='font-family: Arial, sans-serif; color: #111827;'>
                <h2 style='color:#22c55e;'>Verificación de correo</h2>
                <p>Gracias por registrarte en <strong>Store Super Joven</strong>.</p>
                <p>Tu código para verificar el correo es:</p>
                <div style='font-size:32px;font-weight:bold;letter-spacing:6px;background:#f0fdf4;color:#16a34a;padding:18px;border-radius:12px;text-align:center;margin:22px 0;'>{$codigo}</div>
                <p>Este código vence en <strong>10 minutos</strong>.</p>
                <p>Si no intentaste crear una cuenta, ignora este correo.</p>
            </div>
        ";
        $mail->AltBody = "Tu código para verificar tu correo es: {$codigo}. Este código vence en 10 minutos.";

        registrarLogOtp($correoDestino, true, "Antes de enviar", $destinatariosDetectados);
        $mail->send();
        $mail->smtpClose();

        return [
            "enviado" => true,
            "error" => null,
            "destinatarios_detectados" => $destinatariosDetectados
        ];

    } catch (Throwable $error) {
        registrarLogOtp($correoDestino, false, $error->getMessage(), [$correoDestino]);
        return [
            "enviado" => false,
            "error" => $error->getMessage(),
            "destinatarios_detectados" => [$correoDestino]
        ];
    }
}

function normalizarCorreo($correo): string {
    return strtolower(trim((string)$correo));
}

function validarCorreoUnico(string $correo): void {
    if ($correo === "") {
        responder(["ok" => false, "mensaje" => "Ingresa tu correo."], 400);
    }

    if (
        !filter_var($correo, FILTER_VALIDATE_EMAIL) ||
        str_contains($correo, ",") ||
        str_contains($correo, ";") ||
        preg_match('/\s/', $correo)
    ) {
        responder(["ok" => false, "mensaje" => "Correo inválido. Ingresa solo un correo."], 400);
    }
}

function obtenerOtpRegistroValido(PDO $pdo, string $correo, string $codigo, bool $bloquear = false) {
    $sql = "
        SELECT id_otp, correo, codigo, fecha_expiracion, usado, intentos
        FROM RegistroCorreoOtps
        WHERE correo = :correo
          AND usado = 0
        ORDER BY id_otp DESC
        LIMIT 1
    ";

    if ($bloquear) {
        $sql .= " FOR UPDATE";
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute([":correo" => $correo]);
    $otp = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$otp) return null;
    if ((int)$otp["intentos"] >= 5) return null;
    if (strtotime($otp["fecha_expiracion"]) < time()) return null;

    if ((string)$otp["codigo"] !== (string)$codigo) {
        aumentarIntentosOtpRegistro($pdo, (int)$otp["id_otp"]);
        return null;
    }

    return $otp;
}

function aumentarIntentosOtpRegistro(PDO $pdo, int $idOtp): void {
    $stmt = $pdo->prepare("
        UPDATE RegistroCorreoOtps
        SET intentos = intentos + 1
        WHERE id_otp = :id_otp
        LIMIT 1
    ");
    $stmt->execute([":id_otp" => $idOtp]);
}

function marcarOtpRegistroUsado(PDO $pdo, string $correo, string $codigo): void {
    $stmt = $pdo->prepare("
        UPDATE RegistroCorreoOtps
        SET usado = 1
        WHERE correo = :correo
          AND codigo = :codigo
          AND usado = 0
        ORDER BY id_otp DESC
        LIMIT 1
    ");
    $stmt->execute([":correo" => $correo, ":codigo" => $codigo]);
}

function registrarLogOtp(string $correoDestino, bool $enviado, ?string $mensaje, array $destinatarios): void {
    $logPath = __DIR__ . "/otp_registro_debug.log";
    $linea = sprintf(
        "[%s] escrito=%s enviado=%s destinatarios=%s mensaje=%s%s",
        date("Y-m-d H:i:s"),
        $correoDestino,
        $enviado ? "si" : "no",
        implode(",", $destinatarios),
        $mensaje ?: "ninguno",
        PHP_EOL
    );
    @file_put_contents($logPath, $linea, FILE_APPEND);
}

function rollbackSeguro(PDO $pdo): void {
    try {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
    } catch (Throwable $error) {
        error_log("No se pudo revertir transacción OTP: " . $error->getMessage());
    }
}

function responder(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
