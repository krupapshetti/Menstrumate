function makeQrSvg(amount, paymentId) {
  const cells = 21;
  let rects = "";
  
  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      const finder =
        (x < 7 && y < 7) ||
        (x > 13 && y < 7) ||
        (x < 7 && y > 13);
      const hash = (x * 17 + y * 31 + amount + paymentId.length) % 5;
      if (finder || hash === 0 || hash === 2) {
        rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      }
    }
  }
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21"><rect width="21" height="21" fill="white"/><g fill="black">${rects}</g></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// ✅ ADD THIS:
module.exports = {
  makeQrSvg
};