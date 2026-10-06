function register() {
  navigator.serviceWorker
    .register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    })
    .catch(() => {});
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (document.readyState === "complete") {
    register();
    return;
  }

  window.addEventListener("load", register, { once: true });
}
