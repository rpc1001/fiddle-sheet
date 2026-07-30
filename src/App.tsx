import { type CSSProperties, useRef } from "react";
import { Grid } from "./components/Grid";
import { StatusBar } from "./components/StatusBar";
import { TitleBar } from "./components/TitleBar";
import {
  COL_WIDTH,
  COLS,
  GUTTER_WIDTH,
  HEADER_HEIGHT,
  ROW_HEIGHT,
  SHEET_HEIGHT,
} from "./core/geometry";

// geometry is defined once in core/geometry.ts; stylesheets read it through these
const geometry = {
  "--cols": COLS,
  "--col-w": `${COL_WIDTH}px`,
  "--row-h": `${ROW_HEIGHT}px`,
  "--header-h": `${HEADER_HEIGHT}px`,
  "--gutter-w": `${GUTTER_WIDTH}px`,
  "--sheet-h": `${SHEET_HEIGHT}px`,
} as CSSProperties;

export default function App() {
  const grid = useRef<HTMLDivElement>(null);

  return (
    <div className="app" style={geometry}>
      <TitleBar onDone={() => grid.current?.focus()} />
      <Grid gridRef={grid} />
      <StatusBar />
    </div>
  );
}
