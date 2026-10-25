const openings = {
  saloon: "Салун окружён. Выходите без оружия — и закончим это миром.",
  street: "Улица перекрыта. Сложите оружие и отпустите город.",
  tavern: "Поставьте стаканы на стойку, а оружие на пол. Здесь больше не будет стрельбы по безоружным.",
};
const challenges = [
  "Новый шериф? Посмотрим, как долго ты продержишься.",
  "Наши люди вперемешку с горожанами. Всё ещё рискнёшь выстрелить?",
  "Пока ты целишься в одного, второй уже берёт тебя на мушку.",
  "Думаешь, у тебя хватит патронов на всю нашу шайку?",
  "Я здесь хозяин, шериф. И твоя звезда этого не изменит.",
];
const answers = [
  "Продержусь столько, сколько понадобится. Горожан не трогать.",
  "Я отличу бандита от безоружного. Отпустите людей.",
  "Попробуйте. Я не стану стрелять дважды в одну тень.",
  "Я считаю каждый выстрел. Вам тоже советую.",
  "Твоё время вышло. Этот город больше не будет жить в страхе.",
];
const threats = {
  saloon: "Тогда держись подальше от окон… если успеешь!",
  street: "Ребята, по укрытиям! Не дайте ему пройти по улице!",
  tavern: "За стойку и столы, парни! Шерифу здесь не рады!",
};
const bossThreats = {
  saloon: "Подойди к окну, шериф. Посмотрим, кто останется хозяином города.",
  street: "Я буду за этими ящиками. Сделай шаг, если хватит духу.",
  tavern: "Подойди к стойке. У меня для тебя последний тост.",
};

/** A fresh conversation for every run; reading it never touches saved progress. */
export function getIntroDialogue(level, mapId) {
  const index = Number.isInteger(level) && level >= 0 && level < challenges.length ? level : 0;
  const location = Object.hasOwn(openings, mapId) ? mapId : "saloon";
  const enemy = index === 4 ? { speaker: "boss", name: "Главарь" } : { speaker: "bandit", name: "Бандит" };
  const hero = { speaker: "hero", name: "Шериф" };
  return [
    { ...hero, text: openings[location] },
    { ...enemy, text: challenges[index] },
    { ...hero, text: answers[index] },
    { ...enemy, text: (index === 4 ? bossThreats : threats)[location] },
  ];
}
