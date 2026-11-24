import { escapeCsvCell, toCsv } from './csv';

describe('escapeCsvCell', () => {
  it.each([
    ['=HYPERLINK("http://evil.test")', `"'=HYPERLINK(""http://evil.test"")"`],
    ['+1+1', `"'+1+1"`],
    ['-2+3', `"'-2+3"`],
    ['@SUM(A1)', `"'@SUM(A1)"`],
    ['\tcmd', `"'\tcmd"`],
    ['\r=1', `"'\r=1"`],
    ['  =1+1', `"'  =1+1"`],
  ])('neutralises the formula %j', (value, expected) => {
    expect(escapeCsvCell(value)).toBe(expected);
  });

  it('quotes plain text and doubles inner quotes', () => {
    expect(escapeCsvCell('PostgreSQL "17"')).toBe('"PostgreSQL ""17"""');
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
  });

  it('writes empty cells for null and undefined, and stringifies numbers', () => {
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(undefined)).toBe('""');
    expect(escapeCsvCell(42)).toBe('"42"');
  });
});

describe('toCsv', () => {
  it('joins cells with commas and rows with CRLF', () => {
    expect(
      toCsv([
        ['Nombre', 'Versión'],
        ['=cmd', '1.0'],
      ]),
    ).toBe(`"Nombre","Versión"\r\n"'=cmd","1.0"`);
  });
});
