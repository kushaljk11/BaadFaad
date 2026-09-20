/**
 * @fileoverview Landing Page
 * @description Main marketing/landing page for BaadFaad. Features:
 *              - Hero section with animated gradient text and PWA install CTA
 *              - Pain-point cards highlighting common bill-splitting frustrations
 *              - 9 feature cards with hover effects and staggered scroll animations
 *              - Stats bar with animated counters (useOnScreen + Counter)
 *              - How-it-works 3-step guide
 *              - Testimonials carousel
 *              - WhatsApp community CTA
 *              - Payment partners section
 *              Uses Intersection Observer (`useOnScreen` hook) for scroll-triggered
 *              CSS animations and `beforeinstallprompt` for native PWA install.
 *
 * @module pages/landing/Landing
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Footer from "../../components/layout/landing/Footer";
import Topbar from "../../components/layout/landing/Topbar";
import {
  FaArrowRight,
  FaArrowUp,
  FaBars,
  FaBell,
  FaBolt,
  FaCalculator,
  FaChartLine,
  FaClock,
  FaDownload,
  FaExchangeAlt,
  FaFireAlt,
  FaGlobeAsia,
  FaHistory,
  FaMobileAlt,
  FaPlus,
  FaQrcode,
  FaShareAlt,
  FaShieldAlt,
  FaStar,
  FaTrophy,
  FaUserFriends,
  FaUtensils,
  FaVideo,
  FaWhatsapp,
  FaUsers,
  FaWallet,
} from "react-icons/fa";
import esewaLogo from "@root-assets/esewa.png";
import khaltiLogo from "@root-assets/khalti.png";

/* ── Intersection Observer hook for scroll-triggered animations ──────── */
function useOnScreen(options = {}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15, ...options }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [ref, visible];
}

/* ── Animated counter component ──────────────────────────────────────── */
function Counter({ target, suffix = "", duration = 1600 }) {
  const [count, setCount] = useState(0);
  const [ref, visible] = useOnScreen();
  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const id = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(id); }
      else setCount(start);
    }, 16);
    return () => clearInterval(id);
  }, [visible, target, duration]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ── Feature card data ───────────────────────────────────────────────── */
const features = [
  { icon: FaQrcode, title: "Silent Split Mode", desc: "Scan a single QR and everyone joins the room instantly. No typing numbers or search drama.", color: "bg-emerald-100 text-emerald-400" },
  { icon: FaCalculator, title: "Smart Guilt Calculator", desc: "Detects if you're overpaying > 20 % and warns you. Tracks repeat payers so no one gets exploited.", color: "bg-yellow-100 text-yellow-500" },
  { icon: FaPlus, title: "Round-Off Logic", desc: "Automatically rounds to the nearest Rs 10 so nobody has to deal with small-change drama.", color: "bg-blue-100 text-blue-400" },
  { icon: FaClock, title: "Table Timer", desc: "Tracks how long your group has been splitting. Gamified messages keep the energy alive.", color: "bg-purple-100 text-purple-400" },
  { icon: FaTrophy, title: "Big Spender Badge", desc: "The person with the highest share gets crowned. Friendly flex with a golden badge.", color: "bg-amber-100 text-amber-500" },
  { icon: FaHistory, title: "Last Time You Paid", desc: "Never forget who covered the last round of chiya. Keeps a running tab for the whole squad.", color: "bg-rose-100 text-rose-400" },
  { icon: FaShieldAlt, title: "Awkwardness Shield", desc: "Send anonymous nudge reminders to friends who forgot to pay. We play the bad guy, not you.", color: "bg-indigo-100 text-indigo-400" },
  { icon: FaUsers, title: "Breakup Safe Mode", desc: "Instantly settle everything and clear the history with one tap. Clean slate for everyone involved.", color: "bg-teal-100 text-teal-400" },
  { icon: FaMobileAlt, title: "Install as App", desc: "Works offline, installs on your home screen like a native app. Full PWA experience, zero app-store hassle.", color: "bg-slate-200 text-slate-600" },
];

const testimonials = [
  { name: "Ujwal T.", role: "CS Student, Kathmandu", text: "Finally, no more WhatsApp calculator screenshots after momo night. BaadFaad just works." },
  { name: "Rojash T.", role: "Freelancer, Pokhara", text: "The Guilt Calculator saved our friend group. Now nobody can pretend they already paid 😂" },
  { name: "Rakey S.", role: "Startup Founder", text: "We use it for every team dinner. The Table Timer always gets everyone laughing." },
];

/* ── Main Component ──────────────────────────────────────────────────── */
export default function Landing() {
  const navigate = useNavigate();

  const [heroRef, heroVisible] = useOnScreen();
  const [painRef, painVisible] = useOnScreen();
  const [featRef, featVisible] = useOnScreen();
  const [stepRef, stepVisible] = useOnScreen();
  const [waRef, waVisible] = useOnScreen();
  const [testRef, testVisible] = useOnScreen();
  const [pwaRef, pwaVisible] = useOnScreen();

  /* ── PWA install prompt ─────────────────────────────────── */
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [pwaInstalled, setPwaInstalled] = useState(() => window.matchMedia("(display-mode: standalone)").matches);

  /* ── Back to top button ─────────────────────────────────── */
  const [showTop, setShowTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setPwaInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setPwaInstalled(true);
      setDeferredPrompt(null);
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 overflow-x-hidden">
      <Topbar />

      {/* ─── Back to Top ──────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        className={`fixed bottom-8 right-8 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400 text-white shadow-lg shadow-emerald-300/40 transition-all duration-300 hover:bg-emerald-500 hover:scale-110 active:scale-95 ${
          showTop ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0 pointer-events-none"
        }`}
      >
        <FaArrowUp className="text-lg" />
      </button>

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <main className="relative px-6 pb-16 pt-12 sm:px-10 lg:px-16 overflow-hidden">
        {/* Decorative gradient blobs */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-green-200/20 blur-3xl" />

        <section
          ref={heroRef}
          className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2"
        >
          <div className={heroVisible ? "animate-slide-left" : "opacity-0"}>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-xs font-semibold tracking-wider text-emerald-950">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-pulse-ring" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              NOW AVAILABLE ACROSS NEPAL
            </div>

            <h1 className="text-5xl font-semibold leading-[1.2] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
              Split Bills.
              <br />
              <span className="animate-gradient-text bg-size-[200%_auto] bg-linear-to-r from-emerald-400 via-green-500 to-teal-400 bg-clip-text text-transparent">
                Not
              </span>
              <br />
              Friendships.
            </h1>

            <p className="mt-8 max-w-xl text-xl leading-relaxed text-slate-700">
              Seamless Bill Splitting &amp; Payment Management for Nepal. No
              more Rs.&nbsp;7 drama — just scan, split and settle.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="group cursor-pointer rounded-full bg-emerald-400 px-8 py-4 text-xl font-semibold text-slate-900 shadow-lg shadow-emerald-300/60 transition-all duration-300 hover:scale-105 hover:bg-emerald-300 hover:shadow-emerald-300/80 active:scale-95"
              >
                <span className="inline-flex text-slate-950 items-center gap-2">
                  Start Splitting
                  <FaFireAlt className="text-lg text-yellow-400 transition-transform group-hover:rotate-12" />
                </span>
              </button>
              <a
                href="#how-it-works"
                className="rounded-full bg-white px-8 py-4 text-xl font-semibold text-emerald-900 shadow transition hover:bg-slate-50 hover:shadow-md"
              >
                See How It Works
              </a>
            </div>

            <div className="mt-8 flex items-center gap-4">
              <div className="flex -space-x-2">
                {["bg-emerald-300", "bg-amber-200", "bg-rose-200", "bg-blue-200"].map((c, i) => (
                  <span
                    key={i}
                    className={`h-10 w-10 rounded-full border-2 border-zinc-100 ${c}`}
                  />
                ))}
              </div>
              <p className="text-lg font-medium text-slate-700">
                Joined by{" "}
                <span className="font-semibold text-slate-700">10k+ groups</span>{" "}
                this month
              </p>
            </div>
          </div>

          {/* Phone mockup */}
          <div className={`flex justify-center lg:justify-end ${heroVisible ? "animate-slide-right" : "opacity-0"}`}>
            <div className="relative animate-float rounded-[2.5rem] border-8 border-slate-900 bg-slate-900 p-4 shadow-2xl">
              {/* Glow ring behind phone */}
              <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] bg-emerald-400/20 blur-2xl" />

              <div className="h-112 w-56 rounded-[1.8rem] bg-white p-4 sm:h-120 sm:w-64">
                <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
                  <FaBars />
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                    TopThumpi  <FaUtensils className="text-[10px]" />
                  </span>
                  <FaBell />
                </div>

                <div className="rounded-2xl bg-zinc-50 p-4 text-center">
                  <p className="text-[10px] font-semibold tracking-widest text-slate-400">
                    TOTAL BILL
                  </p>
                  <p className="text-4xl font-semibold text-slate-900">
                    Rs.&nbsp;4,250
                  </p>
                </div>

                <div className="mt-4 space-y-3 text-sm">
                  {[
                    { name: "Ujwal", val: "Rs. 840", cls: "bg-zinc-50" },
                    { name: "Rojash", val: "PAID", cls: "bg-zinc-50", valCls: "text-emerald-400" },
                    { name: "Jk (You)", val: "Rs. 1,210", cls: "bg-green-100 border border-emerald-300" },
                  ].map((r) => (
                    <div
                      key={r.name}
                      className={`flex items-center justify-between rounded-2xl px-3 py-2 ${r.cls}`}
                    >
                      <span className="font-semibold text-slate-700">{r.name}</span>
                      <span className={`font-semibold ${r.valCls || "text-slate-800"}`}>{r.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-full bg-emerald-400 px-6 py-3 text-center text-sm font-semibold text-slate-900 transition hover:bg-emerald-300">
                Settle Up Now
              </div>
            </div>
          </div>
        </section>
      </main>


      {/* ─── Pain Points ──────────────────────────────────────────────── */}
      <section
        ref={painRef}
        className="w-full bg-white px-6 py-20 sm:px-8 lg:px-16"
      >
        <div className="mx-auto w-full max-w-6xl">
          <div className={`text-center ${painVisible ? "animate-fade-in-up" : "opacity-0"}`}>
            <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
              The 10-Minute Awkward Ritual
            </h2>
            <p className="mt-4 text-xl text-slate-500">
              We&apos;ve all been there. The dinner is done, but the headache is
              just starting.
            </p>
          </div>

          <div className={`stagger mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 ${painVisible ? "" : "opacity-0"}`}>
            {[
              { icon: FaCalculator, iconCls: "text-red-400", title: "Manual math confusion", desc: "Calculating VAT and Service Charge while everyone stares at you. Stop the mental gymnastics." },
              { icon: FaWallet, iconCls: "text-orange-400", title: "One friend always overpays", desc: "The person who paid shouldn't be the one chasing everyone for weeks. Balance the scales automatically." },
              { icon: FaExchangeAlt, iconCls: "text-blue-400", title: "Rs 7 change drama", desc: '"Ma sanga 7 rupaiya chaina, 10 pathaidinxu hai?" No more hunting for small change.' },
            ].map((c) => (
              <article
                key={c.title}
                className="animate-fade-in-up group rounded-3xl bg-zinc-100 p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-white ${c.iconCls} transition-transform duration-300 group-hover:scale-110`}>
                  <c.icon className="text-xl" />
                </div>
                <h3 className="text-2xl font-semibold text-slate-900">{c.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-slate-500">{c.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─────────────────────────────────────────────────── */}
      <section
        id="features"
        ref={featRef}
        className="w-full bg-zinc-100 px-6 py-20 sm:px-8 lg:px-16"
      >
        <div className="mx-auto w-full max-w-6xl">
          <div className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${featVisible ? "animate-fade-in-up" : "opacity-0"}`}>
            <div>
              <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
                Designed for Real Tables{" "}
                <FaBolt className="inline text-green-600" />
              </h2>
              <p className="mt-3 text-xl text-slate-500">
                9 features that handle the social complexity of sharing costs.
              </p>
            </div>
            <a
              href="#features"
              className="inline-flex items-center gap-2 text-xl font-semibold text-emerald-400 transition hover:text-emerald-500 hover:gap-3"
            >
              View all features <FaArrowRight className="text-base" />
            </a>
          </div>

          <div className={`stagger mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 ${featVisible ? "" : "opacity-0"}`}>
            {features.map((f) => (
              <article
                key={f.title}
                className="animate-fade-in-up group rounded-3xl border border-zinc-200 bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-100/40"
              >
                <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-full ${f.color} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}>
                  <f.icon className="text-lg" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 sm:text-2xl">
                  {f.title}
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-slate-500">
                  {f.desc}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─────────────────────────────────────────────── */}
      <section
        id="how-it-works"
        ref={stepRef}
        className="relative w-full bg-linear-to-br from-slate-950 via-slate-900 to-emerald-950 px-6 py-24 sm:px-8 lg:px-16 overflow-hidden"
      >
        {/* Decorative floating orbs */}
        <div className="pointer-events-none absolute top-16 left-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-2xl animate-float" />
        <div className="pointer-events-none absolute bottom-10 right-16 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl" style={{ animationDelay: "2s" }} />

        <div className="relative mx-auto w-full max-w-6xl">
          <div className={`text-center ${stepVisible ? "animate-fade-in-up" : "opacity-0"}`}>
            <h2 className="text-4xl font-semibold text-white">
              3 Simple Steps to Harmony
            </h2>
            <p className="mt-4 text-lg text-slate-400">
              Because splitting should be as fast as eating.
            </p>
          </div>

          <div className={`stagger relative mt-16 grid grid-cols-1 gap-10 md:grid-cols-3 ${stepVisible ? "" : "opacity-0"}`}>
            {/* Connector line */}
            <div className="pointer-events-none absolute left-0 right-0 top-9 hidden border-t border-dashed border-emerald-800/50 md:block" />

            {[
              { num: "1", title: "Snap or Enter Bill", desc: "Take a photo of the restaurant bill or just type in the total amount manually." },
              { num: "2", title: "Select Items", desc: "Invite friends via link or QR. Everyone taps the items they actually ate." },
              { num: "3", title: "Pay Clean Amount", desc: "Pay your exact share instantly via integrated eSewa or Khalti wallets." },
            ].map((s) => (
              <article
                key={s.num}
                className="animate-fade-in-up group relative text-center"
              >
                <div className="relative mx-auto mb-6 flex h-18 w-18 items-center justify-center rounded-full bg-emerald-400 text-4xl font-semibold text-slate-950 shadow-lg shadow-emerald-400/30 transition-transform duration-300 group-hover:scale-110">
                  {s.num}
                </div>
                <h3 className="text-2xl font-semibold text-white">{s.title}</h3>
                <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
                  {s.desc}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─────────────────────────────────────────────── */}
      <section
        ref={testRef}
        className="w-full bg-white px-6 py-20 sm:px-8 lg:px-16"
      >
        <div className="mx-auto w-full max-w-6xl">
          <div className={`text-center ${testVisible ? "animate-fade-in-up" : "opacity-0"}`}>
            <h2 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
              Loved by Real Groups
            </h2>
            <p className="mt-4 text-xl text-slate-500">
              Hear what our users say about splitting with BaadFaad.
            </p>
          </div>

          <div className={`stagger mt-12 grid grid-cols-1 gap-6 md:grid-cols-3 ${testVisible ? "" : "opacity-0"}`}>
            {testimonials.map((t) => (
              <article
                key={t.name}
                className="animate-fade-in-up group relative rounded-3xl border border-zinc-200 bg-zinc-50 p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:border-emerald-200 hover:shadow-emerald-100/30"
              >
                {/* Hover glow */}
                <div className="pointer-events-none absolute inset-0 rounded-3xl bg-linear-to-br from-emerald-50/0 to-emerald-100/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:from-emerald-50/40 group-hover:to-transparent" />
                <div className="mb-4 flex gap-1 text-yellow-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <FaStar key={i} className="text-sm" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-slate-600 italic">
                  &ldquo;{t.text}&rdquo;
                </p>
                <div className="mt-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-200 text-sm font-semibold text-emerald-700">
                    {t.name.charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.role}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WhatsApp CTA ─────────────────────────────────────────────── */}
      <section
        ref={waRef}
        className="w-full bg-zinc-100 px-6 py-16 sm:px-8 lg:px-16"
      >
        <div
          className={`mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 rounded-[2.5rem] bg-emerald-100 px-8 py-10 shadow-sm lg:grid-cols-2 lg:px-14 lg:py-14 ${waVisible ? "animate-fade-in-up" : "opacity-0"}`}
        >
          <div>
            <h2 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
              Ready to kill the awkwardness?
            </h2>
            <p className="mt-6 max-w-xl text-xl leading-relaxed text-slate-500">
              Share the split link directly to your WhatsApp group. No more
              &ldquo;Who owes how much?&rdquo; messages at 11&nbsp;PM.
            </p>
            <button
              type="button"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-green-500 px-8 py-4 text-xl font-semibold text-white shadow-lg shadow-green-300/40 transition-all duration-300 hover:scale-105 hover:bg-green-600 active:scale-95"
            >
              <FaShareAlt className="text-base" />
              Share on WhatsApp
            </button>
          </div>

          <div className="justify-self-center lg:justify-self-end">
            <div className="w-full max-w-104 rounded-[1.8rem] bg-white p-5 shadow-xl shadow-emerald-200/60 transition-transform duration-500 hover:rotate-1 hover:scale-[1.02]">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
                <div className="flex items-center gap-3">
                  <span className="h-12 w-12 rounded-full bg-zinc-200" />
                  <div>
                    <p className="text-lg font-semibold text-slate-800">
                      Mandala Group 2026
                    </p>
                    <p className="text-xs text-emerald-500">online</p>
                  </div>
                </div>
                <FaVideo className="text-slate-400" />
              </div>

              <div className="mt-4 space-y-4 text-sm">
                <div className="max-w-[85%] rounded-2xl bg-zinc-100 px-4 py-3 text-slate-600">
                  Aaja ko dinner ko bill split gareko xu hai guys. Heram la!
                </div>
                <div className="rounded-2xl border border-emerald-300 bg-emerald-100 px-4 py-3">
                  <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-800">
                    <span>BaadFaad | Momo Night</span>
                    <FaWhatsapp className="text-emerald-500" />
                  </div>
                  <p className="text-xs text-slate-500">Your Share</p>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="text-3xl font-semibold text-slate-900">
                      Rs.&nbsp;5,630
                    </p>
                    <button
                      type="button"
                      className="rounded-full bg-emerald-400 px-4 py-1 text-xs font-semibold text-white transition hover:bg-emerald-300"
                    >
                      Pay Now
                    </button>
                  </div>
                </div>
                <div className="ml-auto w-fit rounded-full bg-zinc-100 px-4 py-2 text-sm text-slate-500">
                  Sent just now ✓✓
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PWA Install CTA ──────────────────────────────────────────── */}
      <section
        ref={pwaRef}
        className="relative w-full bg-linear-to-br from-slate-900 to-slate-800 px-6 py-24 sm:px-8 lg:px-16 overflow-hidden"
      >
        {/* Animated decorative rings */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-125 w-125 rounded-full border border-emerald-500/10 animate-pulse-ring" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-87.5 w-87.5 rounded-full border border-emerald-400/10" style={{ animationDelay: "1s" }} />

        <div
          className={`relative mx-auto flex w-full max-w-4xl flex-col items-center text-center ${pwaVisible ? "animate-fade-in-up" : "opacity-0"}`}
        >
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-400/20 text-emerald-400 shadow-lg shadow-emerald-400/10">
            <FaDownload className="text-3xl" />
          </div>
          <h2 className="text-3xl font-semibold text-white sm:text-5xl">
            Install BaadFaad on Your Phone
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-400">
            Works offline, loads instantly and lives on your home screen &mdash;
            no app store required. Just tap <strong className="text-white">Install</strong> when prompted.
          </p>

          {/* Feature pills */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {["Offline Ready", "Instant Load", "No App Store", "Auto Updates"].map((tag) => (
              <span key={tag} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300">
                {tag}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={handleInstallClick}
            disabled={pwaInstalled}
            className={`mt-10 inline-flex items-center gap-2 rounded-full px-10 py-5 text-xl font-semibold shadow-lg transition-all duration-300 active:scale-95 ${
              pwaInstalled
                ? "bg-emerald-200 text-emerald-700 shadow-emerald-200/20 cursor-default"
                : "bg-emerald-400 text-slate-900 shadow-emerald-400/30 hover:scale-105 hover:bg-emerald-300 hover:shadow-emerald-300/50"
            }`}
          >
            <FaDownload /> {pwaInstalled ? "Installed ✓" : deferredPrompt ? "Install App" : "Get Started Free"}
          </button>
        </div>
      </section>

      {/* ─── Payment Partners ─────────────────────────────────────────── */}
      <section className="w-full bg-zinc-100 px-6 py-12 sm:px-8 lg:px-16">
        <div className="mx-auto w-full max-w-6xl">
          <p className="text-center text-sm font-semibold tracking-[0.2em] text-slate-700">
            POWERING INSTANT SETTLEMENTS WITH
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-10 sm:gap-14">
            {[{ src: esewaLogo, alt: "eSewa", label: "eSewa" }, { src: khaltiLogo, alt: "Khalti", label: "Khalti" }].map((p) => (
              <div
                key={p.alt}
                className="flex items-center gap-3 grayscale transition duration-300 hover:grayscale-0"
              >
                <img src={p.src} alt={p.alt} className="h-10 w-auto object-contain" />
                <p className="font-medium text-slate-600">{p.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
