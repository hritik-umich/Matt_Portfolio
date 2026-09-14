// ============================================================
// main.js — general site behavior (nav, footer year, filters)
// Map-specific logic lives in js/map.js
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  // Footer year
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Mobile nav toggle
  const navToggle = document.getElementById("navToggle");
  const navMenu = document.getElementById("navMenu");
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => {
      const isOpen = navMenu.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    // Close menu after a link is tapped (mobile)
    navMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navMenu.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ----------------------------------------------------------
  // Hero eyebrow: cycle the titles, typing each in a letter at a
  // time. The titles live in the markup as plain spans so the line
  // still reads correctly with JS disabled; we only take over once
  // we're sure we can drive it.
  // ----------------------------------------------------------
  const titleHost = document.getElementById("heroTitles");
  if (titleHost) {
    const titles = [...titleHost.querySelectorAll("span")].map((el) => el.textContent.trim());
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const LETTER_STAGGER = 45; // ms between letters
    const HOLD = 2100; // ms the finished title stays put
    const EXIT = 280; // ms for the word to clear out

    if (titles.length) {
      titleHost.classList.add("is-live");
      let index = 0;

      const buildWord = (text) => {
        const word = document.createElement("span");
        word.className = "hero__eyebrow-word";
        // Letters are decorative once split up — the container's
        // aria-label already announces the full list of titles.
        word.setAttribute("aria-hidden", "true");
        [...text].forEach((char, i) => {
          const letter = document.createElement("span");
          letter.className = "hero__eyebrow-letter";
          letter.textContent = char;
          letter.style.animationDelay = `${i * LETTER_STAGGER}ms`;
          word.appendChild(letter);
        });
        return word;
      };

      const showNext = () => {
        const text = titles[index];
        index = (index + 1) % titles.length;

        const word = buildWord(text);
        titleHost.appendChild(word);

        const typing = reduceMotion ? 0 : text.length * LETTER_STAGGER + 340;
        const visible = typing + HOLD;

        window.setTimeout(() => {
          word.classList.add("is-leaving");
          window.setTimeout(() => {
            word.remove();
            showNext();
          }, reduceMotion ? 0 : EXIT);
        }, visible);
      };

      showNext();
    }
  }

  // Highlight active nav link on scroll
  const sections = document.querySelectorAll("main section[id]");
  const navLinks = document.querySelectorAll(".nav__menu a");

  const highlightNav = () => {
    let currentId = "";
    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= 120 && rect.bottom >= 120) {
        currentId = section.id;
      }
    });
    navLinks.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === `#${currentId}`);
    });
  };

  window.addEventListener("scroll", highlightNav, { passive: true });
  highlightNav();
});
