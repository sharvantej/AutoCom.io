const setupUrl = "https://github.com/sharvantej/AutoCom.io/releases/download/v2.0.0/Autocom_2.0.0_x64-setup.exe";
const portableUrl = "https://github.com/sharvantej/AutoCom.io/releases/download/v2.0.0/Autocom.exe";

const setupBtn = document.getElementById("setupDownloadBtn");
const portableBtn = document.getElementById("portableDownloadBtn");
const heroDownloadBtn = document.getElementById("heroDownloadBtn");

if (setupBtn) setupBtn.setAttribute("href", setupUrl);
if (portableBtn) portableBtn.setAttribute("href", portableUrl);
if (heroDownloadBtn) heroDownloadBtn.setAttribute("href", setupUrl);

[setupBtn, portableBtn, heroDownloadBtn].forEach((button) => {
  if (button) {
    button.setAttribute("target", "_blank");
    button.setAttribute("rel", "noreferrer");
  }
});

const notifyBtn = document.getElementById("notifyBtn");
const email = document.getElementById("email");

if (notifyBtn && email) {
  notifyBtn.addEventListener("click", () => {
    if (!email.value.trim() || !email.value.includes("@")) {
      email.focus();
      return;
    }
    notifyBtn.textContent = "Thanks!";
    setTimeout(() => {
      notifyBtn.textContent = "Notify Me";
      email.value = "";
    }, 1500);
  });
}
