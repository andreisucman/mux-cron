export function delayExecution(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getExponentialBackoffDelay(
  attempt: number,
  baseDelay = 1000,
  maxDelay = 12000
) {
  const rawDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelay - baseDelay / 2; // random value between -0.5*baseDelay and 0.5*baseDelay
  return Math.min(rawDelay + jitter, maxDelay);
}

type DaysFromProps = {
  date?: Date;
  days: number;
};

export function daysFrom({ date = new Date(), days }: DaysFromProps) {
  return new Date(new Date(date).getTime() + days * 24 * 60 * 60 * 1000);
}

type FormatDateProps = {
  date: Date | string;
  hideYear?: boolean;
  hideMonth?: boolean;
  addTime?: boolean;
};

export function formatDate({
  date,
  hideYear,
  hideMonth,
  addTime,
}: FormatDateProps) {
  const dateObj = new Date(date);
  const day = dateObj.getDate();
  const monthIndex = dateObj.getMonth();
  const year = dateObj.getFullYear().toString().slice(2);
  const hour = dateObj.getHours().toString().padStart(2, "0");
  const minute = dateObj.getMinutes().toString().padStart(2, "0");

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  let dateString = `${day} `;
  if (!hideMonth) {
    dateString += `${months[monthIndex]} `;
  }
  if (!hideYear && !hideMonth) {
    dateString += `${year} `;
  }
  if (addTime) {
    dateString += `- ${hour}:${minute}`;
  }
  return dateString.trim();
}
