/**
 * base.jinja.js
 * Runs on every page. Handles shared UI behaviour.
 * - Highlights active nav link based on current page
 */

document.addEventListener("DOMContentLoaded", () => {
  highlightActiveNav();
});

function highlightActiveNav() {
  const path = window.location.pathname;
  const navLinks = document.querySelectorAll(".page-nav-link");

  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    // Match exact path or index
    const isActive =
      path === href ||
      (path === "/" && href === "/index.html") ||
      (path.endsWith("/") && href === "/index.html");

    link.classList.toggle("active", isActive);
  });
}
