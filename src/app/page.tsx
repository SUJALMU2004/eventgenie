import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Sparkles,
  ShieldCheck,
  Heart,
  CakeSlice,
  UsersRound,
  WandSparkles,
  ListChecks,
  Wallet,
  ArrowRight,
} from "lucide-react";
import { CelebrationArt } from "@/components/celebration-art";
import { eventDescriptions, eventLabels } from "@/data/templates";
import { eventTypes } from "@/schemas/event";
import { Button } from "@/components/ui/button";

const icons = { wedding: Heart, birthday: CakeSlice, community: UsersRound };
export default function Home() {
  return (
    <main id="main">
      <section className="hero page-width" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="tiny-star" aria-hidden="true">
              ✳
            </span>{" "}
            LESS PLANNING STRESS. MORE HAPPY MOMENTS.
          </p>
          <h1 id="hero-title">
            Big moments.
            <br />
            Little details.
            <br />
            <em>All taken care of.</em>
          </h1>
          <p className="hero-description">
            From the first idea to the final checklist, turn your celebration
            into a thoughtful plan. Your vision, your budget — a little help
            from AI. Compare What-If strategies, review Budget Rescue, and
            prepare a contingency plan alongside your timeline and vendor
            checklist.
          </p>
          <div className="hero-actions">
            <Button asChild>
              <Link href="/plan">
                Let’s plan something special{" "}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </Button>
            <Link className="text-link" href="/plan?demo=wedding">
              Explore a sample plan <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="hero-trust">
            <span>
              <Check size={14} aria-hidden="true" /> No sign-up
            </span>
            <span>
              <Check size={14} aria-hidden="true" /> Your budget, respected
            </span>
            <span>
              <Check size={14} aria-hidden="true" /> Made for India
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="art-label">
            <span aria-hidden="true">✧</span> Good things are coming
          </div>
          <CelebrationArt />
          <div className="floating-note note-budget">
            <span className="note-icon">
              <Wallet size={18} aria-hidden="true" />
            </span>
            <div>
              <strong>A budget that adds up</strong>
              <span>Every rupee has a little purpose.</span>
            </div>
            <span className="check-circle" aria-hidden="true">
              ✓
            </span>
          </div>
          <div className="floating-note note-plan">
            <span className="note-icon peach">
              <ListChecks size={18} aria-hidden="true" />
            </span>
            <div>
              <strong>A plan for your kind of party</strong>
              <span>Thoughtfully yours. Right from the start.</span>
            </div>
          </div>
          <span className="art-caption">a little organised magic.</span>
        </div>
      </section>
      <div className="promise-strip">
        <p>
          <Sparkles size={16} aria-hidden="true" /> A little AI magic. A lot of
          thoughtful planning.
        </p>
        <span>Ideas with personality</span>
        <span>Budgets with clarity</span>
        <span>Checklists with a purpose</span>
      </div>
      <section className="section page-width" aria-labelledby="occasion-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">EVERY OCCASION HAS A STORY</p>
            <h2 id="occasion-title">What are we celebrating?</h2>
          </div>
          <p>
            There’s no one-size-fits-all celebration.
            <br />
            There shouldn’t be a one-size-fits-all plan.
          </p>
        </div>
        <div className="occasion-grid">
          {eventTypes.map((type, index) => {
            const Icon = icons[type];
            return (
              <Link
                className={`occasion-card occasion-${type}`}
                href={`/plan?type=${type}`}
                key={type}
              >
                <div className="occasion-top">
                  <span className="occasion-icon">
                    <Icon size={27} strokeWidth={1.5} aria-hidden="true" />
                  </span>
                  <span className="occasion-number">0{index + 1}</span>
                </div>
                <h3>{eventLabels[type]}</h3>
                <p>{eventDescriptions[type]}</p>
                <span className="occasion-bottom">
                  Plan{" "}
                  {type === "wedding"
                    ? "a wedding"
                    : type === "birthday"
                      ? "a birthday"
                      : "a community event"}
                  <ArrowUpRight size={20} aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
      <section
        id="how-it-works"
        className="section how-section page-width"
        aria-labelledby="how-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              FROM “WHERE DO I START?” TO “WE’VE GOT THIS.”
            </p>
            <h2 id="how-title">Your celebration, in three simple steps.</h2>
          </div>
          <span className="handwritten">
            You bring the occasion.
            <br />
            We bring the plan. ↙
          </span>
        </div>
        <ol className="steps-grid">
          <li>
            <span className="step-number">01</span>
            <h3>Tell us your vision</h3>
            <p>
              A date, a place, a budget, and the details that make it yours.
            </p>
          </li>
          <li>
            <span className="step-number">02</span>
            <h3>Let the ideas come together</h3>
            <p>
              AI shapes a practical blueprint, tailored to your people and
              priorities.
            </p>
          </li>
          <li>
            <span className="step-number">03</span>
            <h3>Make the moments happen</h3>
            <p>
              Follow your timeline, check off the details, and enjoy the
              celebration.
            </p>
          </li>
        </ol>
      </section>
      <section
        className="feature-band page-width"
        aria-labelledby="features-title"
      >
        <div>
          <p className="eyebrow">THOUGHTFUL BY DESIGN</p>
          <h2 id="features-title">
            Everything you need.
            <br />
            <em>Room to make it yours.</em>
          </h2>
          <p>One clear blueprint. All the moving pieces.</p>
          <Button asChild variant="secondary">
            <Link href="/plan">
              Start your event plan{" "}
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <div className="feature-grid">
          {[
            {
              Icon: Wallet,
              title: "Budgets that balance",
              text: "Exact allocations, clear priorities, and a little set aside for surprises.",
            },
            {
              Icon: ListChecks,
              title: "A timeline with purpose",
              text: "Actionable tasks that work backwards from your big day.",
            },
            {
              Icon: WandSparkles,
              title: "Ideas with your personality",
              text: "Themes, food, and little touches shaped around your preferences.",
            },
            {
              Icon: ShieldCheck,
              title: "Your plans stay with you",
              text: "Saved in this browser. No account, no public profile, no fuss.",
            },
          ].map(({ Icon, title, text }) => (
            <div key={title}>
              <Icon size={23} strokeWidth={1.5} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="closing page-width">
        <span aria-hidden="true">✳</span>
        <h2>The best part is still ahead.</h2>
        <p>Let’s make a little space for the joy.</p>
        <Button asChild>
          <Link href="/plan">
            Start planning, for free{" "}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </Button>
      </section>
    </main>
  );
}
