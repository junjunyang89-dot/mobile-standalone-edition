/** 把预览区点击换算到截图上的位置。左边拖滚动条只是看图，必须按整张图算，不能用可视区域里的 offsetX。 */

export type ShotClickPoint = {
  /** 相对展示图的 CSS 像素，用来画红点 */
  cssX: number
  cssY: number
  xRatio: number
  yRatio: number
  pixelX?: number
  pixelY?: number
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n))
}

/**
 * @param imgRect 图在视口里的盒子（滚上去时 top 为负，高度仍是整张图）
 * @param layout 图的布局宽高；若浏览器把 overflow 裁成「窗口高」，用这个 + 滚动补偿
 */
export function mapInspectShotClick(input: {
  clientX: number
  clientY: number
  imgRect: { left: number; top: number; width: number; height: number }
  layoutWidth: number
  layoutHeight: number
  naturalWidth: number
  naturalHeight: number
  wrap?: {
    left: number
    top: number
    clientWidth: number
    clientHeight: number
    scrollLeft: number
    scrollTop: number
  }
  imgOffsetLeft?: number
  imgOffsetTop?: number
}): ShotClickPoint | null {
  const { imgRect, layoutWidth, layoutHeight, wrap } = input
  let cssX: number
  let cssY: number
  let dispW: number
  let dispH: number

  const clipped =
    !!wrap &&
    layoutHeight > wrap.clientHeight + 8 &&
    imgRect.height > 0 &&
    imgRect.height < layoutHeight * 0.95

  if (clipped && wrap) {
    cssX = input.clientX - wrap.left + wrap.scrollLeft - (input.imgOffsetLeft || 0)
    cssY = input.clientY - wrap.top + wrap.scrollTop - (input.imgOffsetTop || 0)
    dispW = layoutWidth
    dispH = layoutHeight
  } else if (imgRect.width <= 0 || imgRect.height <= 0) {
    return null
  } else {
    cssX = input.clientX - imgRect.left
    cssY = input.clientY - imgRect.top
    dispW = imgRect.width
    dispH = imgRect.height
  }

  if (dispW <= 0 || dispH <= 0) return null
  cssX = Math.min(Math.max(cssX, 0), dispW)
  cssY = Math.min(Math.max(cssY, 0), dispH)
  const xRatio = clamp01(cssX / dispW)
  const yRatio = clamp01(cssY / dispH)
  const natW = input.naturalWidth
  const natH = input.naturalHeight
  return {
    cssX,
    cssY,
    xRatio,
    yRatio,
    pixelX: natW > 0 ? Math.round(xRatio * (natW - 1)) : undefined,
    pixelY: natH > 0 ? Math.round(yRatio * (natH - 1)) : undefined
  }
}
