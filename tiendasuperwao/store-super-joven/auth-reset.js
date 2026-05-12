const PASSWORD_RESET_API_URL = "../api/password_reset.php";

let resetPasswordState = {
    correo: "",
    codigo: ""
};

document.addEventListener("DOMContentLoaded", () => {
    setupPasswordResetEvents();
});

function setupPasswordResetEvents() {
    const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
    const backToLoginFromReset = document.getElementById("backToLoginFromReset");
    const backToResetEmail = document.getElementById("backToResetEmail");
    const backToResetCode = document.getElementById("backToResetCode");
    const resetRequestForm = document.getElementById("resetRequestForm");
    const resetCodeForm = document.getElementById("resetCodeForm");
    const resetPasswordForm = document.getElementById("resetPasswordForm");
    const closeModalButton = document.getElementById("cerrarModalSesion");
    const modalSesion = document.getElementById("modalSesion");

    if (forgotPasswordBtn) {
        forgotPasswordBtn.addEventListener("click", showResetRequestForm);
    }

    if (backToLoginFromReset) {
        backToLoginFromReset.addEventListener("click", showLoginFormFromReset);
    }

    if (backToResetEmail) {
        backToResetEmail.addEventListener("click", showResetRequestForm);
    }

    if (backToResetCode) {
        backToResetCode.addEventListener("click", showResetCodeForm);
    }

    if (resetRequestForm) {
        resetRequestForm.addEventListener("submit", async event => {
            event.preventDefault();
            await requestPasswordOtp();
        });
    }

    if (resetCodeForm) {
        resetCodeForm.addEventListener("submit", async event => {
            event.preventDefault();
            await verifyPasswordOtp();
        });
    }

    if (resetPasswordForm) {
        resetPasswordForm.addEventListener("submit", async event => {
            event.preventDefault();
            await changePasswordWithOtp();
        });
    }

    if (closeModalButton) {
        closeModalButton.addEventListener("click", resetPasswordResetFlow);
    }

    if (modalSesion) {
        modalSesion.addEventListener("click", event => {
            if (event.target === modalSesion) {
                resetPasswordResetFlow();
            }
        });
    }
}

function showLoginFormFromReset() {
    clearResetMessages();
    hidePasswordResetForms();

    const loginForm = document.getElementById("formLoginCarrito");

    if (loginForm) {
        loginForm.classList.remove("oculto", "hidden");
    }
}

function resetPasswordResetFlow() {
    ["resetRequestForm", "resetCodeForm", "resetPasswordForm"].forEach(id => {
        const form = document.getElementById(id);

        if (form) {
            form.reset();
        }
    });

    resetPasswordState = { correo: "", codigo: "" };
    clearResetMessages();
    showLoginFormFromReset();
}

function hidePasswordResetForms() {
    ["resetRequestForm", "resetCodeForm", "resetPasswordForm"].forEach(id => {
        const form = document.getElementById(id);

        if (form) {
            form.classList.add("oculto");
            form.classList.add("hidden");
        }
    });
}

function showResetRequestForm() {
    const loginForm = document.getElementById("formLoginCarrito");
    const resetRequestForm = document.getElementById("resetRequestForm");

    clearResetMessages();

    if (loginForm) {
        loginForm.classList.add("oculto");
    }

    hidePasswordResetForms();

    const loginEmail = document.getElementById("loginEmailCarrito");
    const resetEmail = document.getElementById("resetEmail");

    if (resetEmail && loginEmail && loginEmail.value.trim()) {
        resetEmail.value = loginEmail.value.trim();
    }

    if (resetRequestForm) {
        resetRequestForm.classList.remove("oculto", "hidden");
    }
}

function showResetCodeForm() {
    const loginForm = document.getElementById("formLoginCarrito");
    const resetCodeForm = document.getElementById("resetCodeForm");

    clearResetMessages();

    if (loginForm) {
        loginForm.classList.add("oculto");
    }

    hidePasswordResetForms();

    if (resetCodeForm) {
        resetCodeForm.classList.remove("oculto", "hidden");
    }
}

function showResetPasswordForm() {
    const loginForm = document.getElementById("formLoginCarrito");
    const resetPasswordForm = document.getElementById("resetPasswordForm");

    clearResetMessages();

    if (loginForm) {
        loginForm.classList.add("oculto");
    }

    hidePasswordResetForms();

    if (resetPasswordForm) {
        resetPasswordForm.classList.remove("oculto", "hidden");
    }
}

async function requestPasswordOtp() {
    const resetEmail = document.getElementById("resetEmail");
    const correo = resetEmail ? resetEmail.value.trim() : "";

    if (!correo) {
        showResetMessage("resetRequestMessage", "Ingresa tu correo.", "error");
        return;
    }

    try {
        const data = await sendPasswordResetRequest({
            accion: "solicitar_otp",
            correo
        });

        resetPasswordState.correo = data.correo || correo;
        resetPasswordState.codigo = "";

        let mensaje = data.mensaje || "Código enviado correctamente.";

        if (data.codigo_prueba) {
            mensaje += ` Código de prueba: ${data.codigo_prueba}`;
        }

        showResetCodeForm();
        showResetMessage("resetCodeMessage", mensaje, "success");

    } catch (error) {
        showResetMessage("resetRequestMessage", error.message, "error");
    }
}

async function verifyPasswordOtp() {
    const resetCode = document.getElementById("resetCode");
    const codigo = resetCode ? resetCode.value.trim() : "";

    if (!resetPasswordState.correo) {
        showResetRequestForm();
        showResetMessage("resetRequestMessage", "Primero ingresa tu correo.", "error");
        return;
    }

    if (!codigo) {
        showResetMessage("resetCodeMessage", "Ingresa el código OTP.", "error");
        return;
    }

    try {
        await sendPasswordResetRequest({
            accion: "verificar_otp",
            correo: resetPasswordState.correo,
            codigo
        });

        resetPasswordState.codigo = codigo;
        showResetPasswordForm();
        showResetMessage("resetPasswordMessage", "Código verificado. Ahora crea tu nueva contraseña.", "success");

    } catch (error) {
        showResetMessage("resetCodeMessage", error.message, "error");
    }
}

async function changePasswordWithOtp() {
    const newPassword = document.getElementById("resetNewPassword")?.value || "";
    const confirmPassword = document.getElementById("resetConfirmPassword")?.value || "";

    if (!resetPasswordState.correo || !resetPasswordState.codigo) {
        showResetRequestForm();
        showResetMessage("resetRequestMessage", "Solicita y valida un código primero.", "error");
        return;
    }

    if (!newPassword || !confirmPassword) {
        showResetMessage("resetPasswordMessage", "Completa las contraseñas.", "error");
        return;
    }

    if (newPassword !== confirmPassword) {
        showResetMessage("resetPasswordMessage", "Las contraseñas no coinciden.", "error");
        return;
    }

    try {
        const data = await sendPasswordResetRequest({
            accion: "cambiar_password",
            correo: resetPasswordState.correo,
            codigo: resetPasswordState.codigo,
            nueva_clave: newPassword,
            confirmar_clave: confirmPassword
        });

        const loginEmail = document.getElementById("loginEmailCarrito");

        if (loginEmail) {
            loginEmail.value = resetPasswordState.correo;
        }

        resetPasswordResetFlow();
        alert(data.mensaje || "Contraseña actualizada correctamente.");

    } catch (error) {
        showResetMessage("resetPasswordMessage", error.message, "error");
    }
}

async function sendPasswordResetRequest(payload) {
    const response = await fetch(PASSWORD_RESET_API_URL, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const text = await response.text();
    let data;

    try {
        data = JSON.parse(text);
    } catch (error) {
        console.error("Respuesta cruda de password_reset.php:", text);
        throw new Error("password_reset.php no devolvió JSON válido.");
    }

    if (!response.ok || data.ok === false) {
        throw new Error(data.mensaje || "No se pudo procesar la solicitud.");
    }

    return data;
}

function showResetMessage(id, message, type = "success") {
    const element = document.getElementById(id);

    if (!element) return;

    element.textContent = message;
    element.classList.remove("oculto", "hidden", "success", "error");
    element.classList.add(type === "error" ? "error" : "success");
}

function clearResetMessages() {
    ["resetRequestMessage", "resetCodeMessage", "resetPasswordMessage"].forEach(id => {
        const element = document.getElementById(id);

        if (!element) return;

        element.textContent = "";
        element.classList.add("oculto");
        element.classList.add("hidden");
        element.classList.remove("success", "error");
    });
}

window.AuthPasswordReset = {
    resetAll: resetPasswordResetFlow,
    showLogin: showLoginFormFromReset,
    showResetRequest: showResetRequestForm
};
