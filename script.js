const gameState = {
  screen: "start",
  playerName: "",
  anger: 0,
  round: 1,
  currentTurn: "player",
  loadedChamber: 5,
  currentChamber: 0,
  gameOver: false,
  hasSpun: false,
  actionCount: 0,
  dialogueCount: 1,
  muted: false,
  endingStarted: false
};

const assets = {
  theme: "resources/game_theme.mp3",
  click: "resources/click.mp3",
  tap: "resources/character_tap.mp3",
  annoy: "resources/character_annoy.mp3",
  coffee: "resources/coffee_steal.mp3",
  cylinder: "resources/cylinder_click.mp3",
  fire: "resources/revolver_fire.mp3"
};

const audio = Object.fromEntries(Object.entries(assets).map(([name, src]) => {
  const sound = new Audio(src);
  sound.preload = name === "theme" ? "auto" : "metadata";
  if (name === "theme") {
    sound.loop = true;
    sound.volume = .2;
  } else {
    sound.volume = .62;
  }
  return [name, sound];
}));

const screens = {
  title: document.querySelector("#title-screen"),
  classroom: document.querySelector("#classroom-screen"),
  roulette: document.querySelector("#roulette-screen"),
  ending: document.querySelector("#ending-screen")
};
const modalBackdrop = document.querySelector("#modal-backdrop");
const modalCards = [...document.querySelectorAll(".modal-card")];
const playerNameInput = document.querySelector("#player-name");
const teacherWrap = document.querySelector("#teacher-wrap");
const classroomStage = document.querySelector("#classroom-stage");
const actionButtons = [...document.querySelectorAll(".action-button")];
const rageFill = document.querySelector("#rage-fill");
const rageTrack = document.querySelector("#rage-track");
const rageState = document.querySelector("#rage-state");
const dialogueText = document.querySelector("#dialogue-text");
const dialogueIndex = document.querySelector("#dialogue-index");
const coffeeProp = document.querySelector("#coffee-prop");
const codePaper = document.querySelector("#code-paper");
const codeGhost = document.querySelector("#code-ghost");
const toast = document.querySelector("#toast");
const chamberWheel = document.querySelector("#chamber-wheel");
const chamberNodes = [...document.querySelectorAll(".chamber")];
const spinButton = document.querySelector("#spin-button");
const triggerButton = document.querySelector("#trigger-button");
let toastTimer;
let transitionTimer;

const reactions = {
  tap: [
    ["Hm?", "What are you doing?", "Stop."],
    ["I said stop.", "STOP TAPPING MY HEAD.", "I AM A TEACHER, NOT A TOUCHSCREEN!"],
    ["Touch my head one more time and I'm assigning pointers.", "I AM A TEACHER, NOT A TOUCHSCREEN!", "This is not a user interface!"]
  ],
  poke: [
    ["Ow.", "Hey.", "Why are you poking me?"],
    ["HEY.", "STOP POKING ME!", "I'M NOT A BUTTON!"],
    ["That is not how you debug a person.", "One more poke and your lab partner is a semicolon.", "I'M NOT A BUTTON!"]
  ],
  throw: [
    ["Did you just throw that at me?", "Really?", "Oh, we're doing this now?"],
    ["WHY DID YOU PRINT IT 999,999 TIMES?", "PICK THAT UP.", "WHAT IS THAT?"],
    ["That code has more loops than your excuse has steps.", "I am grading that projectile.", "WHY DID YOU PRINT IT 999,999 TIMES?"]
  ],
  coffee: [
    ["Hey.", "That's mine.", "Give it back."],
    ["I NEED THAT FOR GRADING.", "THAT COFFEE IS THE ONLY THING KEEPING THIS CLASS ALIVE.", "Give it back!"],
    ["That was my last working resource.", "You have stolen my only dependency.", "THAT COFFEE IS THE ONLY THING KEEPING THIS CLASS ALIVE."]
  ],
  shake: [
    ["What are you doing?", "Stop.", "STOP."],
    ["THE TABLE!", "STOP SHAKING THE TABLE!!!", "My coffee has uncommitted changes!"],
    ["This desk has tenure. Leave it alone!", "I am trying to teach data structures here!", "STOP SHAKING THE TABLE!!!"]
  ],
  delete: [
    ["...", "You didn't.", "Was that my code?"],
    ["THAT WAS THREE HOURS OF WORK!", "UNDO! UNDO! UNDO!", "The backup! Check the backup!"],
    ["My code is gone. My weekend is gone. You did this.", "There was no version control?!", "UNDO! UNDO! UNDO!"]
  ],
  hate: [
    ["You really hate CSE that much?", "You've got some nerve.", "You know I spent years learning this stuff?"],
    ["And now you're telling me you hate it?", "I have a whole syllabus with your name on it.", "You've got some nerve."],
    ["I will have you know my code compiles on my machine.", "You hate CSE? The feeling is mutual, student.", "And now you're telling me you hate it?"]
  ]
};

const actionSettings = {
  tap: { anger: 5, sound: "tap", expression: "annoyed" },
  poke: { anger: 7, sound: "tap", expression: "annoyed" },
  throw: { anger: 10, sound: "annoy", expression: "annoyed" },
  coffee: { anger: 15, sound: "coffee", expression: "angry" },
  shake: { anger: 20, sound: "annoy", expression: "angry" },
  delete: { anger: 20, sound: "annoy", expression: "angry" },
  hate: { anger: 10, sound: "annoy", expression: "angry" }
};

function playSound(name) {
  if (gameState.muted) return;
  const sound = audio[name];
  if (!sound) return;
  try {
    sound.currentTime = 0;
    const playback = sound.play();
    if (playback?.catch) playback.catch(() => {});
  } catch { /* Audio may be unavailable in a restricted browser context. */ }
}

function startTheme() {
  const playback = audio.theme.play();
  if (playback?.catch) playback.catch(() => {});
}

function fadeTheme(volume, duration = 700) {
  const sound = audio.theme;
  const initial = sound.volume;
  const started = performance.now();
  const step = (now) => {
    const progress = Math.min((now - started) / duration, 1);
    sound.volume = initial + (volume - initial) * progress;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function setScreen(screenName) {
  Object.entries(screens).forEach(([name, screen]) => {
    screen.classList.toggle("is-active", name === screenName);
  });
  gameState.screen = screenName;
}

function openModal(id) {
  modalCards.forEach((card) => { card.hidden = card.id !== id; });
  modalBackdrop.hidden = false;
  const focusTarget = id === "name-modal" ? playerNameInput : document.querySelector(`#${id} button`);
  window.setTimeout(() => focusTarget?.focus(), 30);
}

function closeModal() {
  modalBackdrop.hidden = true;
  modalCards.forEach((card) => { card.hidden = true; });
}

function setExpression(expression, roulette = false) {
  if (roulette) {
    const image = document.querySelector("[data-roulette-expression]");
    image.style.opacity = "0";
    window.setTimeout(() => {
      image.src = `resources/${expression}.png`;
      image.alt = `The CSE teacher looking ${expression}`;
      image.style.opacity = "1";
    }, 100);
    return;
  }
  document.querySelectorAll(".teacher-expression").forEach((image) => {
    const visible = image.dataset.expression === expression;
    image.classList.toggle("is-visible", visible);
    image.alt = visible ? `CSE teacher looking ${expression}` : "";
    image.setAttribute("aria-hidden", String(!visible));
  });
}

function setDialogue(text, speaker = "THE TEACHER") {
  dialogueText.textContent = text;
  document.querySelector("#speaker-name").textContent = speaker;
  gameState.dialogueCount += 1;
  dialogueIndex.textContent = String(gameState.dialogueCount).padStart(2, "0");
  dialogueText.classList.remove("text-refresh");
  void dialogueText.offsetWidth;
}

function getRageTier() {
  if (gameState.anger >= 100) return 3;
  if (gameState.anger >= 70) return 2;
  if (gameState.anger >= 40) return 1;
  return 0;
}

function updateRage() {
  const anger = Math.min(gameState.anger, 100);
  const tier = getRageTier();
  const labels = ["NORMAL", "WARNING", "STACK OVERFLOW", "SEGMENTATION FAULT"];
  rageFill.style.width = `${anger}%`;
  rageTrack.setAttribute("aria-valuenow", String(anger));
  rageState.textContent = labels[tier];
  rageState.style.color = tier >= 2 ? "var(--red-bright)" : tier === 1 ? "var(--amber)" : "var(--green)";
  if (gameState.screen !== "classroom") return;
  if (tier === 0) setExpression(gameState.actionCount ? "annoyed" : "neutral");
  else if (tier === 1) setExpression("annoyed");
  else setExpression("angry");
}

function chooseReaction(action) {
  const tier = getRageTier();
  const pool = reactions[action][Math.min(tier, 2)];
  return pool[Math.floor(Math.random() * pool.length)];
}

function showToast(message, duration = 1450) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), duration);
}

function animateClassroom(className, target = classroomStage, duration = 650) {
  target.classList.remove(className);
  void target.offsetWidth;
  target.classList.add(className);
  window.setTimeout(() => target.classList.remove(className), duration);
}

function doAction(action) {
  if (gameState.screen !== "classroom" || gameState.endingStarted || !actionSettings[action]) return;
  const setting = actionSettings[action];
  gameState.actionCount += 1;
  gameState.anger = Math.min(100, gameState.anger + setting.anger);
  playSound(setting.sound);
  setExpression(setting.expression);
  updateRage();
  const reaction = chooseReaction(action);
  setDialogue(gameState.actionCount === 1 ? `${gameState.playerName}, ${reaction}` : reaction);

  if (action === "tap" || action === "poke") animateClassroom("is-tapping", teacherWrap, 320);
  if (action === "throw") {
    codePaper.classList.remove("is-flying");
    void codePaper.offsetWidth;
    codePaper.classList.add("is-flying");
  }
  if (action === "coffee") {
    coffeeProp.classList.add("is-stolen");
    window.setTimeout(() => coffeeProp.classList.remove("is-stolen"), 1500);
  }
  if (action === "shake") animateClassroom("is-shaking", classroomStage, 460);
  if (action === "delete") {
    codeGhost.classList.add("is-visible");
    window.setTimeout(() => codeGhost.classList.remove("is-visible"), 1300);
  }

  if (gameState.anger >= 100) {
    updateRage();
    beginRouletteTransition();
    return;
  }
  if (gameState.actionCount >= 3 && Math.random() < .1) triggerSpecialEvent();
}

function triggerSpecialEvent() {
  const event = Math.random();
  if (event < .34) {
    setExpression("annoyed");
    setDialogue("Can you explain this loop?");
    const loopLines = ["Explain it.", "Explain it.", "Explain it.", "INFINITE LOOP DETECTED"];
    loopLines.forEach((line, index) => {
      window.setTimeout(() => {
        if (gameState.screen === "classroom" && !gameState.endingStarted) setDialogue(line);
      }, 450 * (index + 1));
    });
  } else if (event < .67) {
    const cascade = document.querySelector("#error-cascade");
    cascade.classList.remove("is-active");
    void cascade.offsetWidth;
    cascade.classList.add("is-active");
    setDialogue("There is one small error. Find it.");
  } else {
    openModal("viva-modal");
  }
}

function startVivaAnswer(answer) {
  closeModal();
  setDialogue(answer === "Sir, please." ? "A surprisingly correct answer." : answer === "It points." ? "Points where? Into your final grade?" : "At least you're honest. That's worth half a mark.");
  playSound("annoy");
}

function beginRouletteTransition() {
  if (gameState.endingStarted) return;
  gameState.endingStarted = true;
  actionButtons.forEach((button) => { button.disabled = true; });
  setExpression("angry");
  document.querySelector("#scene-label").textContent = "STACK OVERFLOW · NO RECOVERY";
  setDialogue(`${gameState.playerName}, you really hate CSE that much?`);
  showToast("SEGMENTATION FAULT: TEACHER.EXE HAS STOPPED RESPONDING", 1500);
  const curtain = document.querySelector("#transition-curtain");
  window.setTimeout(() => {
    setDialogue("Fine.");
    showToast("The teacher places a revolver on the desk.", 1100);
  }, 1050);
  window.setTimeout(() => setDialogue("Let's play."), 1900);
  curtain.classList.remove("is-active");
  void curtain.offsetWidth;
  curtain.classList.add("is-active");
  transitionTimer = window.setTimeout(() => {
    setScreen("roulette");
    initializeRoulette();
  }, 2300);
}

function initializeRoulette() {
  gameState.round = 1;
  gameState.currentTurn = "player";
  gameState.currentChamber = 0;
  gameState.loadedChamber = 5;
  gameState.gameOver = false;
  gameState.hasSpun = false;
  gameState.endingStarted = false;
  chamberNodes.forEach((node) => node.classList.remove("is-current", "is-empty", "is-loaded"));
  updateRouletteUI();
  setExpression("scared", true);
  fadeTheme(.13);
  document.querySelector("#roulette-dialogue").textContent = "One spin. One pull. Let's see how your luck holds.";
}

function updateRouletteUI() {
  const isPlayer = gameState.currentTurn === "player";
  document.querySelector("#turn-label").textContent = isPlayer ? "YOUR TURN" : "TEACHER'S TURN";
  document.querySelector("#turn-copy").textContent = isPlayer ? "PLAYER TURN" : "TEACHER TURN";
  document.querySelector("#turn-round").textContent = `ROUND ${String(Math.floor(gameState.currentChamber / 2) + 1).padStart(2, "0")}`;
  document.querySelector("#chamber-count").textContent = String(Math.min(gameState.currentChamber + 1, 6)).padStart(2, "0");
  chamberNodes.forEach((node, index) => {
    node.classList.toggle("is-current", index === gameState.currentChamber && !gameState.gameOver);
  });
  spinButton.disabled = gameState.hasSpun || gameState.gameOver;
  triggerButton.disabled = !gameState.hasSpun || gameState.gameOver;
  document.querySelector("#control-hint").textContent = gameState.gameOver ? "Exam concluded. Please collect your imaginary degree." : gameState.hasSpun ? "Cylinder set. Pull when you're ready." : "Spin the cylinder to begin.";
}

function spinCylinder() {
  if (gameState.screen !== "roulette" || gameState.hasSpun || gameState.gameOver) return;
  playSound("click");
  playSound("cylinder");
  gameState.hasSpun = true;
  const wheelFrame = document.querySelector(".wheel-frame");
  wheelFrame.classList.remove("is-spinning");
  void wheelFrame.offsetWidth;
  wheelFrame.classList.add("is-spinning");
  chamberWheel.style.transform = "rotate(0deg)";
  requestAnimationFrame(() => { chamberWheel.style.transform = "rotate(1080deg)"; });
  document.querySelector("#roulette-dialogue").textContent = gameState.currentTurn === "teacher" ? "... Wait. Why am I suddenly nervous?" : "The cylinder turns. The teacher watches.";
  updateRouletteUI();
  window.setTimeout(() => wheelFrame.classList.remove("is-spinning"), 1050);
}

function triggerChamber() {
  if (gameState.screen !== "roulette" || !gameState.hasSpun || gameState.gameOver) return;
  playSound("click");
  const chamber = gameState.currentChamber;
  const isTeacher = gameState.currentTurn === "teacher";
  const isLoaded = chamber === gameState.loadedChamber;
  gameState.hasSpun = false;
  gameState.round = Math.floor(chamber / 2) + 1;
  spinButton.disabled = true;
  triggerButton.disabled = true;

  if (isLoaded) {
    resolveLoadedChamber();
    return;
  }

  playSound("cylinder");
  chamberNodes[chamber].classList.remove("is-current");
  chamberNodes[chamber].classList.add("is-empty");
  animateClassroom("is-recoiling", document.querySelector("#roulette-screen"), 380);
  if (isTeacher) {
    setExpression("smug", true);
    document.querySelector("#roulette-dialogue").textContent = "Heh. Looks like I'm still here. Your turn.";
  } else {
    document.querySelector("#roulette-dialogue").textContent = ["Click. Lucky.", "An empty chamber. Still hate CSE?", "Looks like you get another turn."][Math.min(chamber, 2)];
    setExpression("scared", true);
  }
  gameState.currentChamber += 1;
  gameState.currentTurn = gameState.currentChamber % 2 === 0 ? "player" : "teacher";
  updateRouletteUI();
}

function resolveLoadedChamber() {
  gameState.gameOver = true;
  gameState.currentTurn = "teacher";
  chamberNodes[gameState.loadedChamber].classList.add("is-loaded", "is-current");
  playSound("fire");
  document.querySelector("#roulette-dialogue").textContent = "Wait... No. No no no...";
  document.querySelector("#turn-label").textContent = "FINAL CHAMBER";
  document.querySelector("#turn-copy").textContent = "TEACHER TURN";
  setExpression("shocked", true);
  document.querySelector("#roulette-screen").classList.add("is-recoiling");
  document.querySelector("#roulette-screen").classList.add("is-final-shot");
  document.querySelector("#roulette-flash").classList.add("is-active");
  document.querySelector("#smoke-layer").classList.add("is-active");
  document.querySelector("#control-hint").textContent = "...";
  window.setTimeout(() => {
    document.querySelector("#roulette-dialogue").textContent = "TEACHER LOSES.";
    showCrashEnding();
  }, 1500);
}

function showCrashEnding() {
  setScreen("ending");
  fadeTheme(.17);
  const crashWindow = document.querySelector("#crash-window");
  crashWindow.classList.remove("is-visible");
  void crashWindow.offsetWidth;
  crashWindow.classList.add("is-visible");
  window.setTimeout(() => crashWindow.classList.remove("is-visible"), 3000);
}

function resetGame(goToClassroom = false) {
  window.clearTimeout(transitionTimer);
  const returningName = gameState.playerName;
  closeModal();
  gameState.screen = "start";
  gameState.anger = 0;
  gameState.round = 1;
  gameState.currentTurn = "player";
  gameState.loadedChamber = 5;
  gameState.currentChamber = 0;
  gameState.gameOver = false;
  gameState.hasSpun = false;
  gameState.actionCount = 0;
  gameState.dialogueCount = 1;
  gameState.endingStarted = false;
  gameState.playerName = "";
  playerNameInput.value = "";
  actionButtons.forEach((button) => { button.disabled = false; });
  coffeeProp.classList.remove("is-stolen");
  codePaper.classList.remove("is-flying");
  codeGhost.classList.remove("is-visible");
  document.querySelector("#roulette-screen").classList.remove("is-recoiling");
  document.querySelector("#roulette-screen").classList.remove("is-final-shot");
  document.querySelector("#roulette-flash").classList.remove("is-active");
  document.querySelector("#smoke-layer").classList.remove("is-active");
  rageFill.style.width = "0%";
  rageTrack.setAttribute("aria-valuenow", "0");
  rageState.textContent = "NORMAL";
  rageState.style.color = "var(--green)";
  dialogueText.textContent = "The assignment was due yesterday. You did submit it, right?";
  dialogueIndex.textContent = "01";
  document.querySelector("#scene-label").textContent = "ROOM 204 · OFFICE HOURS";
  document.querySelector("#crash-window").classList.remove("is-visible");
  chamberNodes.forEach((node) => node.classList.remove("is-current", "is-empty", "is-loaded"));
  setExpression("neutral");
  setExpression("neutral", true);
  if (goToClassroom) {
    gameState.playerName = returningName || "Student";
    gameState.screen = "classroom";
    setScreen("classroom");
    setDialogue(`Back again, ${gameState.playerName}? I knew office hours would be popular.`);
    startTheme();
    updateRage();
  } else {
    setScreen("title");
    fadeTheme(.2);
  }
}

document.querySelector("#play-button").addEventListener("click", () => {
  playSound("click");
  startTheme();
  openModal("name-modal");
});
document.querySelector("#how-button").addEventListener("click", () => {
  playSound("click");
  startTheme();
  openModal("how-modal");
});
document.querySelector("#got-it-button").addEventListener("click", () => {
  playSound("click");
  closeModal();
});
document.querySelector("#start-button").addEventListener("click", startGame);
playerNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") startGame();
});
function startGame() {
  playSound("click");
  gameState.playerName = playerNameInput.value.trim() || "Student";
  closeModal();
  gameState.anger = 0;
  gameState.actionCount = 0;
  gameState.endingStarted = false;
  setScreen("classroom");
  setExpression("neutral");
  setDialogue(`Oh, you're ${gameState.playerName}. The assignment was due yesterday. You did submit it, right?`);
  updateRage();
  startTheme();
}

document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", () => {
  playSound("click");
  closeModal();
}));
modalBackdrop.addEventListener("click", (event) => {
  if (event.target === modalBackdrop) closeModal();
});
document.querySelectorAll("[data-viva]").forEach((button) => button.addEventListener("click", () => {
  playSound("click");
  startVivaAnswer(button.dataset.viva);
}));
actionButtons.forEach((button) => button.addEventListener("click", () => doAction(button.dataset.action)));
spinButton.addEventListener("click", spinCylinder);
triggerButton.addEventListener("click", triggerChamber);
document.querySelector("#sound-toggle").addEventListener("click", (event) => {
  gameState.muted = !gameState.muted;
  document.querySelector("#game-shell").classList.toggle("is-muted", gameState.muted);
  event.currentTarget.setAttribute("aria-label", gameState.muted ? "Unmute audio" : "Mute audio");
  event.currentTarget.title = gameState.muted ? "Unmute audio" : "Mute audio";
  if (!gameState.muted) playSound("click");
  audio.theme.muted = gameState.muted;
});
document.querySelector("#play-again-button").addEventListener("click", () => {
  playSound("click");
  resetGame(false);
  openModal("name-modal");
});
document.querySelector("#annoy-again-button").addEventListener("click", () => {
  playSound("click");
  resetGame(true);
});
document.querySelector("#home-link").addEventListener("click", (event) => {
  event.preventDefault();
  playSound("click");
  resetGame(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modalBackdrop.hidden) closeModal();
  if (!modalBackdrop.hidden || gameState.screen !== "classroom") return;
  const actionByKey = { "1": "tap", "2": "poke", "3": "throw", "4": "coffee", "5": "shake", "6": "delete", "7": "hate" };
  if (actionByKey[event.key]) doAction(actionByKey[event.key]);
});

setScreen("title");