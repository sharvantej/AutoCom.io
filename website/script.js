// Direct GitHub release-asset links — these serve the file itself (no
// landing/redirect page), so clicking starts the download immediately.
// Update RELEASE_TAG when a new version ships; asset filenames embed the
// version so they can't be made version-agnostic without renaming the
// bundler's output.
const RELEASE_TAG = "v2.0.0-alpha";
const RELEASE_BASE = `https://github.com/sharvantej/AutoCom.io/releases/download/${RELEASE_TAG}`;

const DOWNLOADS = {
  windowsSetup: `${RELEASE_BASE}/Autocom_2.0.0-alpha_x64-setup.exe`,
  windowsPortable: `${RELEASE_BASE}/Autocom.exe`,
  macosDmg: `${RELEASE_BASE}/Autocom_2.0.0-alpha_aarch64.dmg`,
  linuxAppImage: `${RELEASE_BASE}/Autocom_2.0.0-alpha_amd64.AppImage`,
  linuxDeb: `${RELEASE_BASE}/Autocom_2.0.0-alpha_amd64.deb`,
};

function setDirectDownload(id, url, filename) {
  const el = document.getElementById(id);
  if (!el) return;
  el.setAttribute("href", url);
  // `download` only takes effect for same-origin URLs in most browsers, but
  // harmless to set — cross-origin GitHub asset URLs already respond with
  // Content-Disposition: attachment, so the browser downloads rather than
  // navigates regardless.
  if (filename) el.setAttribute("download", filename);
  el.removeAttribute("target");
  el.removeAttribute("rel");
}

setDirectDownload("setupDownloadBtn", DOWNLOADS.windowsSetup, "Autocom-Setup.exe");
setDirectDownload("portableDownloadBtn", DOWNLOADS.windowsPortable, "Autocom.exe");
setDirectDownload("dmgDownloadBtn", DOWNLOADS.macosDmg, "Autocom.dmg");
setDirectDownload("appimageDownloadBtn", DOWNLOADS.linuxAppImage, "Autocom.AppImage");
setDirectDownload("debDownloadBtn", DOWNLOADS.linuxDeb, "Autocom.deb");

// ── OS detection: point the hero button at the right platform's primary
// download and highlight that platform's card in the Download section. ──
function detectPlatform() {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return "windows";
  if (/Mac/i.test(platform) || /Macintosh/i.test(ua)) return "macos";
  if (/Linux/i.test(platform) || /Linux/i.test(ua)) return "linux";
  return null;
}

const HERO_DOWNLOAD_BY_PLATFORM = {
  windows: { url: DOWNLOADS.windowsSetup, label: "Download for Windows", filename: "Autocom-Setup.exe" },
  macos: { url: DOWNLOADS.macosDmg, label: "Download for macOS", filename: "Autocom.dmg" },
  linux: { url: DOWNLOADS.linuxAppImage, label: "Download for Linux", filename: "Autocom.AppImage" },
};

const detectedPlatform = detectPlatform();
const heroDownloadBtn = document.getElementById("heroDownloadBtn");
if (heroDownloadBtn && detectedPlatform && HERO_DOWNLOAD_BY_PLATFORM[detectedPlatform]) {
  const hero = HERO_DOWNLOAD_BY_PLATFORM[detectedPlatform];
  heroDownloadBtn.textContent = hero.label;
  setDirectDownload("heroDownloadBtn", hero.url, hero.filename);
}

if (detectedPlatform) {
  const card = document.getElementById(`platform-${detectedPlatform}`);
  if (card) card.classList.add("download-card-highlight");
}

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
