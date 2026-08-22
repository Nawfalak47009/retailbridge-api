export function generateShopUsername(
  count: number,
) {
  return `SHOP${String(count + 1).padStart(4, "0")}`;
}

export function generatePassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let password = "";

  for (let i = 0; i < 8; i++) {
    password +=
      chars[
        Math.floor(
          Math.random() *
            chars.length,
        )
      ];
  }

  return password;
}