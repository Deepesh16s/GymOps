export const MS_PER_DAY = 86400000;

export const dayKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const startOfWeek = (date) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMon);
  return d;
};

export const daysAgo = (date) => Math.floor((Date.now() - new Date(date).getTime()) / MS_PER_DAY);

export const isToday = (date) => dayKey(date) === dayKey(new Date());

export const isYesterday = (date) => {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return dayKey(date) === dayKey(y);
};

export const isTomorrow = (date) => {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return dayKey(date) === dayKey(t);
};
