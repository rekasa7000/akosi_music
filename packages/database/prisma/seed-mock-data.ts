try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional — CI/real deployments inject env vars directly
}

import { prisma } from "../src/index.ts";

// Local-dev-only convenience seed — fills the catalog with enough
// artists/releases/tracks/cards to actually see the admin UI at
// realistic density instead of the 2-artist dataset left over from
// manual feature testing. Not meant to be re-run: artist slugs and
// card codes are fixed, so a second run fails on the unique
// constraints rather than silently duplicating data.

const ARTISTS = [
  { name: "Hollow Static", bio: "Bedroom shoegaze from a basement in Quezon City." },
  { name: "Marigold Youth", bio: "Three-piece indie pop, big on tape hiss and reverb." },
  { name: "Concrete Orchard", bio: "Post-rock instrumentalists, one album a year, no interviews." },
  { name: "Night Jeepney", bio: "Synth-driven city pop with a Manila traffic jam for a muse." },
  { name: "Salt Lamp", bio: "Ambient/folk duo recording entirely on a four-track." },
  { name: "Paper Weather", bio: "Lo-fi singer-songwriter, one take, no overdubs." },
  { name: "Low Tide Radio", bio: "Surf-adjacent garage rock from the south coast." },
  { name: "Glass Province", bio: "Dream pop trio, allergic to choruses." },
  { name: "Static Province", bio: "Noise-pop outfit, loud by accident at first." },
  { name: "Afternoon Delay", bio: "Jazz-inflected R&B, recorded mostly after midnight." },
] as const;

const SONG_WORDS = [
  "Static",
  "Afterglow",
  "Low Light",
  "Rust",
  "Traffic",
  "Monsoon",
  "Paper Moon",
  "Slow Burn",
  "Echo",
  "Fever",
  "Saltwater",
  "Nightshade",
  "Halflight",
  "Driftwood",
  "Quiet Hour",
  "Neon",
  "Undertow",
  "Faded Signal",
  "Glass House",
  "Afternoon",
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function randomDate(daysAgoMax: number): Date {
  return new Date(Date.now() - Math.random() * daysAgoMax * 24 * 60 * 60 * 1000);
}

async function main() {
  const existing = await prisma.artist.findFirst({ where: { slug: slugify(ARTISTS[0].name) } });
  if (existing) {
    throw new Error(
      `Mock artist "${ARTISTS[0].name}" already exists — this script is a one-time seed, not a reset tool.`,
    );
  }

  const allTrackIds: string[] = [];

  for (const { name, bio } of ARTISTS) {
    const artist = await prisma.artist.create({
      data: { name, slug: slugify(name), bio },
    });

    const releaseTitle = pick(SONG_WORDS) + (Math.random() > 0.5 ? " EP" : "");
    const release = await prisma.release.create({
      data: { artistId: artist.id, title: releaseTitle, releasedAt: randomDate(400) },
    });

    const trackCount = 3 + Math.floor(Math.random() * 3); // 3-5
    const usedTitles = new Set<string>();
    for (let i = 1; i <= trackCount; i++) {
      let title = pick(SONG_WORDS);
      while (usedTitles.has(title)) title = pick(SONG_WORDS);
      usedTitles.add(title);

      const mediaType: "AUDIO" | "VIDEO" = Math.random() < 0.15 ? "VIDEO" : "AUDIO";
      const key = `raw/${mediaType === "AUDIO" ? "track-audio" : "track-video"}/mock-${artist.slug}-${i}`;
      const track = await prisma.track.create({
        data: {
          releaseId: release.id,
          title,
          trackNumber: i,
          mediaType,
          status: "READY",
          rawStorageKey: key,
          processedStorageKey: key,
          durationSec: 120 + Math.floor(Math.random() * 180),
        },
      });
      allTrackIds.push(track.id);

      const playCount = Math.floor(Math.random() * 40);
      if (playCount > 0) {
        await prisma.playEvent.createMany({
          data: Array.from({ length: playCount }, () => ({
            trackId: track.id,
            playedAt: randomDate(90),
          })),
        });
      }
    }
  }

  // 50 cards, scattered across roughly half the tracks (some tracks
  // get 0, some get 2-3 — mirrors how a real limited run would land).
  const gatedTrackIds = allTrackIds
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.ceil(allTrackIds.length * 0.5));

  let cardsCreated = 0;
  let trackIndex = 0;
  while (cardsCreated < 50 && gatedTrackIds.length > 0) {
    const trackId = gatedTrackIds[trackIndex % gatedTrackIds.length];
    const track = await prisma.track.findUniqueOrThrow({
      where: { id: trackId },
      include: { release: true },
    });
    cardsCreated++;
    await prisma.card.create({
      data: {
        uid: `MOCK-${String(cardsCreated).padStart(4, "0")}`,
        artistId: track.release.artistId,
        trackId: track.id,
        status: (Math.random() < 0.12 ? "REVOKED" : "UNCLAIMED") as "REVOKED" | "UNCLAIMED",
        editionLabel: Math.random() < 0.3 ? pick(["Launch", "Pre-order", "Tour", "Fan Club"]) : null,
      },
    });
    trackIndex++;
  }

  console.log(
    `Seeded ${ARTISTS.length} artists, ${ARTISTS.length} releases, ${allTrackIds.length} tracks, ${cardsCreated} cards.`,
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
