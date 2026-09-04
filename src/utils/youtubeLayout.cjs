const finitePositive = (value, fallback = 1) => (
  Number.isFinite(value) && value > 0 ? value : fallback
);

/**
 * Returns the largest rectangle that fits inside the available container while
 * preserving the video's aspect ratio. Kept framework-free so the layout
 * contract can be regression-tested without mounting a WebView.
 */
function getAspectFitSize(availableWidth, availableHeight, aspectRatio) {
  const width = finitePositive(availableWidth);
  const height = finitePositive(availableHeight);
  const ratio = finitePositive(aspectRatio, 16 / 9);
  const widthFromHeight = height * ratio;

  if (widthFromHeight <= width) {
    return { width: widthFromHeight, height };
  }

  return { width, height: width / ratio };
}

module.exports = { getAspectFitSize };
