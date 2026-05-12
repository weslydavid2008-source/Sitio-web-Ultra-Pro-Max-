<?php
header("Content-Type: application/json; charset=utf-8");

require_once "conexion.php";

function crearTablaConfiguracionSiNoExiste(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS configuracion_tienda (
            id_configuracion TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,

            nombre_tienda VARCHAR(150) NOT NULL DEFAULT '',
            telefono VARCHAR(50) NOT NULL DEFAULT '',
            email VARCHAR(150) NOT NULL DEFAULT '',
            direccion TEXT NULL,
            id_barrio_tienda varchar(10) NULL,
            hora_apertura TIME NULL,
            hora_cierre TIME NULL,

            costo_envio DECIMAL(12,2) NOT NULL DEFAULT 0.00,
            monto_envio_gratis DECIMAL(12,2) NOT NULL DEFAULT 0.00,

            envio_gratis TINYINT(1) NOT NULL DEFAULT 0,
            recogida_tienda TINYINT(1) NOT NULL DEFAULT 0,
            programar_entregas TINYINT(1) NOT NULL DEFAULT 0,

            notificar_nuevos_pedidos TINYINT(1) NOT NULL DEFAULT 0,
            notificar_stock_bajo TINYINT(1) NOT NULL DEFAULT 0,
            notificar_nuevos_clientes TINYINT(1) NOT NULL DEFAULT 0,
            reporte_diario TINYINT(1) NOT NULL DEFAULT 0,

            canal_email TINYINT(1) NOT NULL DEFAULT 0,
            canal_push TINYINT(1) NOT NULL DEFAULT 0,

            tema VARCHAR(20) NOT NULL DEFAULT 'light',
            color_principal VARCHAR(30) NOT NULL DEFAULT 'green',
            modo_compacto TINYINT(1) NOT NULL DEFAULT 0,

            actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

            CONSTRAINT chk_configuracion_tienda_unica CHECK (id_configuracion = 1)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    try {
        $pdo->exec("ALTER TABLE configuracion_tienda ADD COLUMN id_barrio_tienda varchar(10) NULL AFTER direccion");
    } catch (PDOException $e) {
        // La columna ya existe o no se pudo alterar; se continúa.
    }

    try {
        $pdo->exec("ALTER TABLE configuracion_tienda ADD COLUMN monto_envio_gratis DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER costo_envio");
    } catch (PDOException $e) {
        // La columna ya existe o no se pudo alterar; se continúa.
    }
}

function obtenerConfiguracion(PDO $pdo): array {
    $stmt = $pdo->prepare("
        SELECT
            nombre_tienda AS storeName,
            telefono AS storePhone,
            email AS storeEmail,
            direccion AS storeAddress,
            id_barrio_tienda AS storeNeighborhood,
            TIME_FORMAT(hora_apertura, '%H:%i') AS openingTime,
            TIME_FORMAT(hora_cierre, '%H:%i') AS closingTime,

            costo_envio AS deliveryCost,
            monto_envio_gratis AS freeDeliveryMinimum,

            envio_gratis AS freeDelivery,
            recogida_tienda AS pickup,

            notificar_nuevos_pedidos AS newOrders,
            notificar_stock_bajo AS lowStock,
            notificar_nuevos_clientes AS newClients,
            reporte_diario AS dailyReport,

            canal_email AS emailChannel,
            canal_push AS pushChannel,

            tema AS theme,
            color_principal AS mainColor,
            modo_compacto AS compactMode,
            actualizado_en
        FROM configuracion_tienda
        WHERE id_configuracion = 1
        LIMIT 1
    ");

    $stmt->execute();
    $configuracion = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($configuracion) {
        return $configuracion;
    }

    $pdo->exec("INSERT INTO configuracion_tienda (id_configuracion) VALUES (1)");

    return obtenerConfiguracion($pdo);
}

function texto(array $data, string $key): string {
    return trim((string)($data[$key] ?? ""));
}

function decimalSeguro(array $data, string $key): float {
    $value = $data[$key] ?? 0;

    if ($value === "" || $value === null) {
        return 0;
    }

    return round((float)$value, 2);
}

function booleano(array $data, string $key): int {
    return !empty($data[$key]) ? 1 : 0;
}

function horaONull(array $data, string $key): ?string {
    $value = texto($data, $key);

    if ($value === "") {
        return null;
    }

    if (!preg_match('/^\d{2}:\d{2}$/', $value)) {
        return null;
    }

    return $value . ":00";
}

try {
    crearTablaConfiguracionSiNoExiste($pdo);

    $method = $_SERVER["REQUEST_METHOD"] ?? "GET";

    if ($method === "GET") {
        echo json_encode([
            "ok" => true,
            "configuracion" => obtenerConfiguracion($pdo)
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($method !== "POST" && $method !== "PUT") {
        http_response_code(405);
        echo json_encode([
            "ok" => false,
            "mensaje" => "Método no permitido."
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $rawInput = file_get_contents("php://input");
    $data = json_decode($rawInput, true);

    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode([
            "ok" => false,
            "mensaje" => "No llegó JSON válido.",
            "debug_raw" => $rawInput
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    obtenerConfiguracion($pdo);

    $stmt = $pdo->prepare("
        UPDATE configuracion_tienda
        SET
            nombre_tienda = :nombre_tienda,
            telefono = :telefono,
            email = :email,
            direccion = :direccion,
            id_barrio_tienda = :id_barrio_tienda,
            hora_apertura = :hora_apertura,
            hora_cierre = :hora_cierre,

            costo_envio = :costo_envio,
            monto_envio_gratis = :monto_envio_gratis,

            envio_gratis = :envio_gratis,
            recogida_tienda = :recogida_tienda,

            notificar_nuevos_pedidos = :notificar_nuevos_pedidos,
            notificar_stock_bajo = :notificar_stock_bajo,
            notificar_nuevos_clientes = :notificar_nuevos_clientes,
            reporte_diario = :reporte_diario,

            canal_email = :canal_email,
            canal_push = :canal_push,

            tema = :tema,
            color_principal = :color_principal,
            modo_compacto = :modo_compacto
        WHERE id_configuracion = 1
    ");

    $stmt->execute([
        ":nombre_tienda" => texto($data, "storeName"),
        ":telefono" => texto($data, "storePhone"),
        ":email" => texto($data, "storeEmail"),
        ":direccion" => texto($data, "storeAddress"),
        ":id_barrio_tienda" => texto($data, "storeNeighborhood") ?: null,
        ":hora_apertura" => horaONull($data, "openingTime"),
        ":hora_cierre" => horaONull($data, "closingTime"),

        ":costo_envio" => decimalSeguro($data, "deliveryCost"),
        ":monto_envio_gratis" => decimalSeguro($data, "freeDeliveryMinimum"),

        ":envio_gratis" => booleano($data, "freeDelivery"),
        ":recogida_tienda" => booleano($data, "pickup"),

        ":notificar_nuevos_pedidos" => booleano($data, "newOrders"),
        ":notificar_stock_bajo" => booleano($data, "lowStock"),
        ":notificar_nuevos_clientes" => booleano($data, "newClients"),
        ":reporte_diario" => booleano($data, "dailyReport"),

        ":canal_email" => booleano($data, "emailChannel"),
        ":canal_push" => booleano($data, "pushChannel"),

        ":tema" => texto($data, "theme") ?: "light",
        ":color_principal" => texto($data, "mainColor") ?: "green",
        ":modo_compacto" => booleano($data, "compactMode")
    ]);

    echo json_encode([
        "ok" => true,
        "mensaje" => "Configuración guardada correctamente.",
        "configuracion" => obtenerConfiguracion($pdo)
    ], JSON_UNESCAPED_UNICODE);
    exit;

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "ok" => false,
        "mensaje" => "Error en configuración: " . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
