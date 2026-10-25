const openings = {
  saloon: "Салун окружён. Выходите без оружия — и закончим это миром.",
  street: "Улица перекрыта. Сложите оружие и отпустите город.",
  tavern: "Поставьте стаканы на стойку, а оружие на пол. Здесь больше не будет стрельбы по безоружным.",
};
const challenges = [
  "Шериф Картер? Посмотрим, как долго ты продержишься.",
  "Наши люди вперемешку с горожанами. Всё ещё рискнёшь выстрелить?",
  "Пока ты целишься в одного, второй уже берёт тебя на мушку.",
  "Думаешь, у тебя хватит патронов на всю нашу шайку?",
  "Твоя Сьюззи пойдёт первой, Картер. Рискнёшь выстрелить, пока она передо мной?",
];
const answers = [
  "Продержусь столько, сколько понадобится. Горожан не трогать.",
  "Я отличу бандита от безоружного. Отпустите людей.",
  "Попробуйте. Я не стану стрелять дважды в одну тень.",
  "Я считаю каждый выстрел. Вам тоже советую.",
  "Держись, Сьюззи. Я вытащу тебя. Пока ты перед ним, я не стреляю.",
];
const threats = {
  saloon: "Тогда держись подальше от окон… если успеешь!",
  street: "Ребята, по укрытиям! Не дайте ему пройти по улице!",
  tavern: "За стойку и столы, парни! Шерифу здесь не рады!",
};
const bossThreats = {
  saloon: "Буду появляться в разных окнах. Попробуй поймать меня без неё!",
  street: "За телегой или за бочками — ты не угадаешь, откуда я выйду!",
  tavern: "То за стойкой, то за столами… Никогда не угадаешь, выйду ли я с ней!",
};
const bossOpenings = {
  saloon: "Сьюззи! Я здесь. Билли Пуля, отпусти её и выходи из салуна.",
  street: "Билли Пуля, отпусти Сьюззи! Не смей прикрываться ею на этой улице.",
  tavern: "Сьюззи, я пришёл за тобой. Билли Пуля, отпусти её и отойди от стойки!",
};

/** A fresh conversation for every run; reading it never touches saved progress. */
export function getIntroDialogue(level, mapId) {
  const index = Number.isInteger(level) && level >= 0 && level < challenges.length ? level : 0;
  const location = Object.hasOwn(openings, mapId) ? mapId : "saloon";
  const enemy = index === 4 ? { speaker: "boss", name: "Билли Пуля" } : { speaker: "bandit", name: "Бандит" };
  const hero = { speaker: "hero", name: "Шериф Картер" };
  if (index === 4) {
    const suzzie = { speaker: "hostage", name: "Сьюззи" };
    return [
      { ...hero, text: bossOpenings[location] },
      { ...enemy, text: challenges[index] },
      { ...suzzie, text: "Помоги мне, любимый! Он не отпускает меня…" },
      { ...hero, text: answers[index] },
      { ...enemy, text: bossThreats[location] },
      { ...suzzie, text: "Пожалуйста, спаси меня! Подожди, пока он отведёт меня за укрытие!" },
      { ...hero, text: "Я дождусь, когда он покажется один. Мы уйдём отсюда вместе." },
    ];
  }
  return [
    { ...hero, text: openings[location] },
    { ...enemy, text: challenges[index] },
    { ...hero, text: answers[index] },
    { ...enemy, text: threats[location] },
  ];
}
