/** Original lightweight illustration; decorative, so no duplicate screen-reader content. */
export function CelebrationArt() {
  return (
    <svg
      className="celebration-art"
      viewBox="0 0 560 530"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="checks"
          width="34"
          height="34"
          patternUnits="userSpaceOnUse"
        >
          <path d="M0 0h34v34H0z" fill="#f3ecdb" />
          <path d="M17 0v34M0 17h34" stroke="#e7ddc4" strokeWidth=".8" />
        </pattern>
        <linearGradient
          id="arch"
          x1="150"
          y1="40"
          x2="420"
          y2="450"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#e4e8d7" />
          <stop offset="1" stopColor="#d3ddca" />
        </linearGradient>
      </defs>
      <path d="M90 460V225a190 190 0 0 1 380 0v235" fill="url(#arch)" />
      <path d="M65 460h445" stroke="#b4bba9" strokeWidth="2" />
      <path
        d="M144 460V222a136 136 0 0 1 272 0v238"
        stroke="#7b947a"
        strokeWidth="2"
      />
      <path d="M160 460V224a120 120 0 0 1 240 0v236" stroke="#a4b498" />
      <ellipse cx="285" cy="451" rx="185" ry="15" fill="#b7c5ad" opacity=".4" />
      <path d="M118 334h321l25 116H95l23-116Z" fill="url(#checks)" />
      <path
        d="M118 335h321l10 25c-15 14-25 14-40 0-15 14-25 14-40 0-15 14-25 14-40 0-15 14-25 14-40 0-15 14-25 14-40 0-15 14-25 14-40 0-15 14-25 14-40 0-15 14-25 14-40 0l9-25Z"
        fill="#faf4e5"
      />
      <ellipse cx="279" cy="336" rx="74" ry="13" fill="#a8af98" />
      <path d="M225 285h108v48c0 13-108 13-108 0v-48Z" fill="#efc8b4" />
      <ellipse cx="279" cy="285" rx="54" ry="11" fill="#fce5d2" />
      <path d="M240 280v-39h78v39c0 12-78 12-78 0Z" fill="#f5dac3" />
      <ellipse cx="279" cy="241" rx="39" ry="8" fill="#fff1db" />
      <path
        d="M240 255c10 12 14-5 23 4 7 9 14-9 21 0 10 10 16-9 23-2 5 5 7 4 11 0v-15h-78v13Z"
        fill="#fff1db"
      />
      <path d="M280 233v-29" stroke="#8f563d" strokeWidth="3" />
      <path d="M280 204c-17-13-1-24 1-30 4 11 13 21-1 30Z" fill="#bc733b" />
      <path
        d="M349 300c-8-20-5-45 7-67M353 274c-17 0-27-9-29-24 18 0 27 10 29 24ZM354 253c14-3 22-12 20-28-15 6-21 14-20 28Z"
        stroke="#32614c"
        strokeWidth="3"
        fill="#63866b"
      />
      <path d="M337 292h32l-5 41h-22l-5-41Z" fill="#b26748" />
      <path
        d="M189 302v30M179 332h20M183 290h12l-2 13h-8l-2-13Z"
        stroke="#6f8670"
        strokeWidth="2"
      />
      <path d="M132 156c-34-19-37-46-26-69 37 8 54 39 26 69Z" fill="#ebbb9a" />
      <path d="M132 156l-3 31" stroke="#9e775b" />
      <path d="m133 183 4 6-8 1 4-7Z" fill="#bc8666" />
      <path d="M444 166c-5-36 18-52 45-47 2 38-24 54-45 47Z" fill="#c6a65a" />
      <path d="m443 165-13 26" stroke="#8d7d4a" />
      <path d="m431 188-7 4 8 3-1-7Z" fill="#9c864e" />
      <path
        d="M189 76l4 15M187 82l10-4M392 64l-8 14M387 68l9 4M482 268l-7 12M473 272l12 5M76 247l5 13M74 253l11-4"
        stroke="#a8754d"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M155 111q126 80 254 0" stroke="#a99059" strokeWidth="1.5" />
      <path
        d="m187 127 15 6-12 16-3-22Zm40 15 15 3-8 18-7-21Zm43 5h16l-8 19-8-19Zm44-2 16-3-5 22-11-19Zm42-11 15-6 1 23-16-17Z"
        fill="#f0c3a1"
      />
      <circle cx="407" cy="220" r="4" fill="#b67d50" />
      <circle cx="99" cy="300" r="4" fill="#8fa581" />
      <path d="M73 393c-19-22-21-52-14-76 22 15 37 44 14 76Z" fill="#7a9476" />
      <path
        d="M76 444c-5-51-2-87 6-118M77 415c24-18 32-40 27-63-22 6-35 34-27 63Z"
        stroke="#6e8869"
        strokeWidth="3"
        fill="#93a589"
      />
      <path d="M55 437h43l-6 29H61l-6-29Z" fill="#bf8768" />
    </svg>
  );
}
