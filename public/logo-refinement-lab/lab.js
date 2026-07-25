const cards = [...document.querySelectorAll(".card")];
const selectionValue = document.querySelector("#selection-value");

for (const card of cards) {
  const button = card.querySelector("button");

  button.addEventListener("click", () => {
    for (const option of cards) {
      option.removeAttribute("aria-current");
      option.querySelector("button").setAttribute("aria-pressed", "false");
    }

    card.setAttribute("aria-current", "true");
    button.setAttribute("aria-pressed", "true");
    selectionValue.textContent = button.dataset.option;
  });
}
