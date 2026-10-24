(() => {
  try {
    const preference = localStorage.getItem("sekka.theme");
    const theme = preference === "light" || preference === "dark"
      ? preference
      : window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === "light" ? "#f8f9ff" : "#101827";
    const statusBarStyle = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (statusBarStyle) statusBarStyle.content = theme === "light" ? "default" : "black";
  } catch {
    document.documentElement.dataset.theme = "dark";
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = "#101827";
    const statusBarStyle = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (statusBarStyle) statusBarStyle.content = "black";
  }
})();
