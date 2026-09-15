import { optimize, type Config, type PluginConfig } from 'svgo';

/**
 * Optional SVGO pass for the markup produced by `outlineSvg`.
 *
 * Kept in its own entry point (`svg-outliner/optimize`) so the core library
 * does not depend on SVGO; install `svgo` yourself to use it.
 */
export interface OptimizeOptions {
  /** Decimal places kept in path data. Default 3. */
  precision?: number;
  /** Extra SVGO plugins appended after the preset. */
  plugins?: PluginConfig[];
  /** Run the plugins until the output stops changing. Default true. */
  multipass?: boolean;
}

/** SVGO configuration used by {@link optimizeSvg}; exported for reuse in your own SVGO pipeline. */
export function svgoConfig(options: OptimizeOptions = {}): Config {
  const precision = options.precision ?? 3;
  return {
    multipass: options.multipass ?? true,
    plugins: [
      {
        name: 'preset-default',
        params: {
          // SVGO 4's preset keeps viewBox, so icons stay scalable without extra config.
          overrides: {
            convertPathData: { floatPrecision: precision },
            cleanupNumericValues: { floatPrecision: precision },
          },
        },
      },
      ...(options.plugins ?? []),
    ],
  };
}

/** Shrink an SVG string with SVGO: relative coordinates, shorthand commands, attribute cleanup. */
export function optimizeSvg(svg: string, options: OptimizeOptions = {}): string {
  return optimize(svg, svgoConfig(options)).data;
}
