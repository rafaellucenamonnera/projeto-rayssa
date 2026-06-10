// Cálculo de horas úteis em America/Sao_Paulo (UTC-3 fixo, sem DST).
// Janela útil: seg-sex 09:00-18:00. Feriados não considerados nesta versão.

const BR_OFFSET_HOURS = -3;
const START_HOUR = 9;
const END_HOUR = 18;

type BRParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
};

function brParts(d: Date): BRParts {
  const u = new Date(d.getTime() + BR_OFFSET_HOURS * 3600 * 1000);
  return {
    year: u.getUTCFullYear(),
    month: u.getUTCMonth(),
    day: u.getUTCDate(),
    weekday: u.getUTCDay(),
    hour: u.getUTCHours(),
    minute: u.getUTCMinutes(),
  };
}

function makeBR(year: number, month: number, day: number, hour: number, minute = 0): Date {
  // hora BR = hora UTC + 3 (porque BR é UTC-3)
  return new Date(Date.UTC(year, month, day, hour - BR_OFFSET_HOURS, minute, 0));
}

function isBusinessDay(weekday: number): boolean {
  return weekday >= 1 && weekday <= 5;
}

function snapToBusinessBR(d: Date): Date {
  let cur = d;
  for (let i = 0; i < 14; i++) {
    const p = brParts(cur);
    if (!isBusinessDay(p.weekday)) {
      cur = makeBR(p.year, p.month, p.day + 1, START_HOUR, 0);
      continue;
    }
    const minutesOfDay = p.hour * 60 + p.minute;
    if (minutesOfDay >= END_HOUR * 60) {
      cur = makeBR(p.year, p.month, p.day + 1, START_HOUR, 0);
      continue;
    }
    if (minutesOfDay < START_HOUR * 60) {
      cur = makeBR(p.year, p.month, p.day, START_HOUR, 0);
      continue;
    }
    return cur;
  }
  return cur;
}

export function addBusinessHoursBR(start: Date, hours: number): Date {
  let cur = snapToBusinessBR(start);
  let remaining = Math.round(hours * 60); // minutes
  for (let i = 0; i < 60 && remaining > 0; i++) {
    const p = brParts(cur);
    const endOfDay = makeBR(p.year, p.month, p.day, END_HOUR, 0);
    const avail = Math.floor((endOfDay.getTime() - cur.getTime()) / 60000);
    if (remaining <= avail) {
      return new Date(cur.getTime() + remaining * 60000);
    }
    remaining -= avail;
    cur = snapToBusinessBR(new Date(endOfDay.getTime() + 60000));
  }
  return cur;
}
