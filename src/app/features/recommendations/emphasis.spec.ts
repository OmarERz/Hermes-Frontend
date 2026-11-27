import { parseEmphasis } from './emphasis';

describe('parseEmphasis', () => {
  it('splits the justification template into strong and plain runs', () => {
    expect(
      parseEmphasis(
        '**Base 74 → Final 86 · impulsada por api-prod.** CVSS 7.5 · en KEV. **Juez +12:** explotación masiva.',
      ),
    ).toEqual([
      { text: 'Base 74 → Final 86 · impulsada por api-prod.', strong: true },
      { text: ' CVSS 7.5 · en KEV. ', strong: false },
      { text: 'Juez +12:', strong: true },
      { text: ' explotación masiva.', strong: false },
    ]);
  });

  it('reads the backslash escapes of outside names as literal characters', () => {
    expect(parseEmphasis('**impulsada por srv\\_web\\*01 \\[prod\\].** fin')).toEqual([
      { text: 'impulsada por srv_web*01 [prod].', strong: true },
      { text: ' fin', strong: false },
    ]);
    expect(parseEmphasis('a \\*\\* b')).toEqual([{ text: 'a ** b', strong: false }]);
  });

  it('keeps a backslash that escapes nothing', () => {
    expect(parseEmphasis('C:\\temp y \\n')).toEqual([{ text: 'C:\\temp y \\n', strong: false }]);
  });

  it('keeps HTML as plain text', () => {
    expect(parseEmphasis('**<img src=x onerror=alert(1)>** <b>no</b>')).toEqual([
      { text: '<img src=x onerror=alert(1)>', strong: true },
      { text: ' <b>no</b>', strong: false },
    ]);
  });

  it('leaves an unpaired marker as text', () => {
    expect(parseEmphasis('a ** b')).toEqual([{ text: 'a ** b', strong: false }]);
    expect(parseEmphasis('**a** b **c')).toEqual([
      { text: 'a', strong: true },
      { text: ' b **c', strong: false },
    ]);
  });

  it('drops empty runs', () => {
    expect(parseEmphasis('')).toEqual([]);
    expect(parseEmphasis('****x')).toEqual([{ text: 'x', strong: false }]);
    expect(parseEmphasis('x**')).toEqual([{ text: 'x**', strong: false }]);
  });
});
