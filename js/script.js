// Madison Lovett, A01292253
// Sept 13th, 2026

// a coloured button that remembers its order
class MemoryButton {
  constructor(order, onClick) {
    this.order = order;
    this.color = MemoryButton.randomColor();
    this.clickable = false;

    this.element = document.createElement("button");
    this.element.type = "button";
    this.element.className = "memory-button";
    this.element.style.backgroundColor = `rgb(${this.color.red}, ${this.color.green}, ${this.color.blue})`;
    this.element.style.color = MemoryButton.isDark(this.color) ? "white" : "black"; // changes text colour depending on box darkness
    this.element.addEventListener("click", () => {
      if (this.clickable) {
        onClick(this);
      }
    });

    this.showNumber();
  }

  // rng RGB values 'color'
  static randomColor() {
    const channel = () => Math.floor(Math.random() * 256);
    return { red: channel(), green: channel(), blue: channel() };
  }

  // "darkness" weights
  static isDark({ red, green, blue }) {
    return (red * 299 + green * 587 + blue * 114) / 1000 < 128;
  }

  showNumber() {
    this.element.textContent = this.order;
  }

  hideNumber() {
    this.element.textContent = "";
  }

  setClickable(clickable) {
    this.clickable = clickable;
    this.element.classList.toggle("clickable", clickable);
  }

  // button should own its move
  moveTo(left, top) {
    this.element.style.position = "fixed";
    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
  }

  remove() {
    this.element.remove();
  }
}

// button moving logic
class ButtonBoard {
  static MAX_PLACEMENT_TRIES = 100;

  constructor(container, form) {
    this.container = container;
    this.form = form; // buttons shouldn't land under this
    this.buttons = [];
  }

  create(count, onClick) {
    this.clear();
    for (let order = 1; order <= count; order++) {
      const button = new MemoryButton(order, onClick);
      this.buttons.push(button);
      this.container.appendChild(button.element);
    }
  }

  scramble() {
    const placed = [this.form.getBoundingClientRect()]; // treat the textbox as already placed
    for (const button of this.buttons) {
      const spot = this.findFreeSpot(button, placed);
      button.moveTo(spot.left, spot.top);
      placed.push(spot);
    }
  }

  // clamp each move to window size, retry random spots until one doesn't overlap
  findFreeSpot(button, placed) {
    const width = button.element.offsetWidth;
    const height = button.element.offsetHeight;
    const maxLeft = Math.max(0, window.innerWidth - width);
    const maxTop = Math.max(0, window.innerHeight - height);

    let spot;
    for (let tries = 0; tries < ButtonBoard.MAX_PLACEMENT_TRIES; tries++) {
      spot = { left: Math.random() * maxLeft, top: Math.random() * maxTop, width, height };
      if (!placed.some((other) => ButtonBoard.overlaps(spot, other))) {
        break;
      }
    }
    return spot; // window too small? just use the last try
  }

  // rectangles overlap unless one is fully left/right/above/below the other
  static overlaps(a, b) {
    return (
      a.left < b.left + b.width &&
      b.left < a.left + a.width &&
      a.top < b.top + b.height &&
      b.top < a.top + a.height
    );
  }

  hideNumbers() {
    this.buttons.forEach((button) => button.hideNumber());
  }

  revealNumbers() {
    this.buttons.forEach((button) => button.showNumber());
  }

  setClickable(clickable) {
    this.buttons.forEach((button) => button.setClickable(clickable));
  }

  // reset
  clear() {
    this.buttons.forEach((button) => button.remove());
    this.buttons = [];
  }
}

// game logic
class MemoryGame {
  static MS_PER_SECOND = 1000;
  static SCRAMBLE_INTERVAL_MS = 2000;

  constructor(board, showMessage) {
    this.board = board;
    this.showMessage = showMessage;
    this.timers = [];
    this.count = 0;
    this.nextOrder = 1;
  }

  start(count) {
    this.stop();
    this.count = count;
    this.nextOrder = 1;
    this.board.create(count, (button) => this.handleClick(button));

    // pause and scramble n times with 2s intervals...
    const pauseMs = count * MemoryGame.MS_PER_SECOND;
    for (let i = 0; i < count; i++) {
      const isLastScramble = i === count - 1;
      this.schedule(() => {
        this.board.scramble();
        if (isLastScramble) {
          this.beginRecall();
        }
      }, pauseMs + i * MemoryGame.SCRAMBLE_INTERVAL_MS);
    }
  }

  schedule(callback, delayMs) {
    this.timers.push(setTimeout(callback, delayMs));
  }

  beginRecall() {
    this.board.hideNumbers();
    this.board.setClickable(true);
  }

  // pass or fail
  handleClick(button) {
    if (button.order === this.nextOrder) {
      button.showNumber();
      button.setClickable(false);
      this.nextOrder++;
      if (this.nextOrder > this.count) {
        this.end(MESSAGES.EXCELLENT_MEMORY);
      }
    } else {
      this.board.revealNumbers();
      this.end(MESSAGES.WRONG_ORDER);
    }
  }

  end(message) {
    this.board.setClickable(false);
    this.showMessage(message);
  }

  // early stop if we restart game
  stop() {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers = [];
    this.board.clear();
  }
}

// formatting...
class GameControls {
  static MIN_BUTTONS = 3;
  static MAX_BUTTONS = 7;

  constructor() {
    this.form = document.getElementById("controls");
    this.label = document.getElementById("countLabel");
    this.input = document.getElementById("countInput");
    this.goButton = document.getElementById("goButton");
    this.message = document.getElementById("message");

    const board = new ButtonBoard(document.getElementById("buttonArea"), this.form);
    this.game = new MemoryGame(board, (text) => this.showMessage(text));

    document.title = MESSAGES.PAGE_TITLE;
    this.label.textContent = MESSAGES.COUNT_LABEL;
    this.goButton.textContent = MESSAGES.GO_BUTTON;
    this.form.addEventListener("submit", (event) => this.handleSubmit(event));
  }

  handleSubmit(event) {
    event.preventDefault();
    const count = this.readCount();
    if (count === null) {
      this.showMessage(MESSAGES.INVALID_COUNT);
      return;
    }
    this.showMessage("");
    this.game.start(count);
  }

  // check if user entered in valid count
  readCount() {
    const value = this.input.value.trim();
    if (!/^\d+$/.test(value)) { // regex for numbers
      return null;
    }
    const count = Number(value);
    const inRange = count >= GameControls.MIN_BUTTONS && count <= GameControls.MAX_BUTTONS;
    return inRange ? count : null;
  }

  showMessage(text) {
    this.message.textContent = text;
  }
}

// entry
document.addEventListener("DOMContentLoaded", () => {
  new GameControls();
});
