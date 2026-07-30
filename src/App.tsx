import type { CSSProperties } from "react";
import { Grid } from "./components/Grid";
import { COL_WIDTH, COLS, GUTTER_WIDTH, HEADER_HEIGHT, ROW_HEIGHT } from "./core/geometry";

// geometry is defined once in core/geometry.ts; stylesheets read it through these
const geometry = {
  "--cols": COLS,
  "--col-w": `${COL_WIDTH}px`,
  "--row-h": `${ROW_HEIGHT}px`,
  "--header-h": `${HEADER_HEIGHT}px`,
  "--gutter-w": `${GUTTER_WIDTH}px`,
} as CSSProperties;

export default function App() {
  return (
    <div className="grid-viewport" style={geometry}>
      <Grid />
    </div>
  );
}
