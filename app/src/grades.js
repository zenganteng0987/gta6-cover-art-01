// Colour grades for Vice Poster: each grade is a diagonal wash laid over the
// panels before the lettering goes on. `stops` are [position, colour] pairs for
// a linear gradient, `blend` is the canvas composite mode for that wash, and
// `accent` is the colour of the ribbon and the star badge for the grade.
export const GRADES = {
  sunset: {
    label: 'Sunset',
    blend: 'soft-light',
    accent: '#ff7e5f',
    stops: [
      [0, '#ffd97a'],
      [0.45, '#ff7e5f'],
      [1, '#c2185b'],
    ],
  },
  neon: {
    label: 'Neon',
    blend: 'overlay',
    accent: '#22d3ee',
    stops: [
      [0, '#22d3ee'],
      [0.5, '#a855f7'],
      [1, '#ec4899'],
    ],
  },
  dusk: {
    label: 'Dusk',
    blend: 'soft-light',
    accent: '#8b7cf6',
    stops: [
      [0, '#312e81'],
      [0.55, '#6d28d9'],
      [1, '#db2777'],
    ],
  },
  gold: {
    label: 'Gold Hour',
    blend: 'soft-light',
    accent: '#f5b942',
    stops: [
      [0, '#fff3c4'],
      [0.5, '#f5b942'],
      [1, '#b45309'],
    ],
  },
};

/** The grade names in the order the editor shows them. */
export const GRADE_NAMES = Object.keys(GRADES);

/** Returns the grade object for `name`, falling back to Sunset. */
export function gradeFor(name) {
  return GRADES[name] ?? GRADES.sunset;
}
