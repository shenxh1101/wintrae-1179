export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}${timestamp}${random}`;
}

export function formatDate(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isSameDay(date1: number, date2: number): boolean {
  return formatDate(date1) === formatDate(date2);
}

export function isYesterday(date: number): boolean {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return formatDate(date) === formatDate(yesterday);
}

export function isBirthday(birthday: string): boolean {
  const today = new Date();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();
  const birthParts = birthday.split(/[-\/]/);
  if (birthParts.length < 3) return false;
  const birthMonth = parseInt(birthParts[1], 10) - 1;
  const birthDay = parseInt(birthParts[2], 10);
  return todayMonth === birthMonth && todayDay === birthDay;
}

export function addDays(timestamp: number, days: number): number {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export function isSameWeek(date1: number, date2: number): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  const onejan = new Date(d1.getFullYear(), 0, 1);
  const week1 = Math.ceil(((d1.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  const week2 = Math.ceil(((d2.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return d1.getFullYear() === d2.getFullYear() && week1 === week2;
}

export function isWithinDays(timestamp: number, days: number): boolean {
  const now = Date.now();
  return timestamp >= now && timestamp <= addDays(now, days);
}
