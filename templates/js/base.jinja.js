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

// Add box shadow to header nav on scroll
window.addEventListener("scroll", () => {
  const nav = document.getElementById("header-nav");
  if (!nav) return;
  nav.classList.toggle("scrolled", window.scrollY > 10);
});
