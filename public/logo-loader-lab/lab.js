const optionNames = {
  1: "01 — Source Trace",
  2: "02 — Page Turn",
  3: "03 — Evidence Relay",
  4: "04 — Verification Scan",
  5: "05 — Calm Focus",
  6: "06 — Reading Loop",
};

const objects = () => [...document.querySelectorAll(".loader-object")];

function setSvgPaused(paused) {
  objects().forEach((object) => {
    const root = object.contentDocument?.documentElement;
    root?.classList.toggle("paused", paused);
  });
}

function getSavedChoice() {
  try {
    const choice = localStorage.getItem("sanad-loader-choice");
    return optionNames[choice] ? choice : "6";
  } catch {
    return "6";
  }
}

function saveChoice(option) {
  try {
    localStorage.setItem("sanad-loader-choice", option);
  } catch {
    // The comparison still works when storage is unavailable.
  }
}

function setMotionState(paused) {
  const button = document.querySelector("#motion-toggle");
  button.setAttribute("aria-pressed", String(paused));
  setSvgPaused(paused);
}

function selectOption(card) {
  document.querySelectorAll(".logo-card").forEach((item) => {
    const isSelected = item === card;
    const button = item.querySelector(".select-button");

    item.dataset.selected = String(isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  const option = card.dataset.option;
  document.querySelector("#selection-value").textContent = optionNames[option];
  saveChoice(option);
}

function replayAll() {
  setMotionState(false);
  const stamp = Date.now();
  objects().forEach((object) => {
    const source = object.data.split("?")[0];
    object.data = `${source}?replay=${stamp}`;
  });
}

document.querySelectorAll(".select-button").forEach((button) => {
  button.addEventListener("click", () => selectOption(button.closest(".logo-card")));
});

document.querySelector("#motion-toggle").addEventListener("click", (event) => {
  const paused = event.currentTarget.getAttribute("aria-pressed") !== "true";
  setMotionState(paused);
});

document.querySelector("#replay-button").addEventListener("click", replayAll);

document.querySelector("#surface-toggle").addEventListener("click", (event) => {
  const dark = event.currentTarget.getAttribute("aria-pressed") !== "true";
  event.currentTarget.setAttribute("aria-pressed", String(dark));
  document.body.classList.toggle("dark-surface", dark);
});

document.querySelector("#size-slider").addEventListener("input", (event) => {
  document.documentElement.style.setProperty("--loader-size", `${event.target.value}px`);
});

objects().forEach((object) => {
  object.addEventListener("load", () => {
    const paused = document.querySelector("#motion-toggle").getAttribute("aria-pressed") === "true";
    object.contentDocument?.documentElement.classList.toggle("paused", paused);
  });
});

const initialChoice = getSavedChoice();
const initialCard = document.querySelector(`.logo-card[data-option="${initialChoice}"]`);
if (initialCard) selectOption(initialCard);
