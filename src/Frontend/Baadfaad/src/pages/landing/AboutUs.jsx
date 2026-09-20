/**
 * @fileoverview About Us Page
 * @description Showcases the BaadFaad team and mission. Displays:
 *              - Team member cards with initials, names, and roles
 *              - "Why BaadFaad" bullet points with check-circle icons
 *              - Clash-A-Thon 2026 context section
 *              - CTA to start splitting
 *              Wrapped in the landing Topbar and Footer layout.
 *
 * @module pages/landing/AboutUs
 */
import { FaArrowRight, FaCheckCircle } from "react-icons/fa";
import Footer from "../../components/layout/landing/Footer";
import Topbar from "../../components/layout/landing/Topbar";

const teamMembers = [
  { name: "Kushal Jamarkattel", role: "Team Lead & Frontend", initials: "JK" },
  { name: "Samana Upreti", role: "UI/UX Designer", initials: "SU" },
  { name: "Regan Karki", role: "Business & QA", initials: "RK" },
  { name: "Rojesh Thapa", role: "Backend Developer", initials: "RT" },
  { name: "Ujjwal Timsina", role: "Database & Logic", initials: "UT" },
];

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-zinc-100">
      <Topbar />

      <main className="px-6 pb-16 pt-8 sm:px-10 lg:px-16">
        <section className="mx-auto w-full max-w-6xl">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div>
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-4 py-1 text-xs font-bold tracking-wider text-emerald-800">
                A SOCIAL SPLITTING APP FOR 2026
              </span>

              <h1 className="mt-6 text-5xl font-bold leading-tight text-slate-900 sm:text-6xl">
                Built by 
                <br />
                <span className="text-emerald-700">Students.</span>
                <br />
                For Real <br />
                <span className="text-emerald-700"></span>Tables.
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-700">
                From the halls of student innovation at College to every dining
                table in Nepal. We&apos;re redefining how shared moments are
                split fair.
              </p>

              <button
                type="button"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-emerald-400 px-7 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-emerald-300/50 transition hover:bg-emerald-300"
              >
                Join the Beta <FaArrowRight className="text-xs" />
              </button>
            </div>

            <div className="justify-self-center lg:justify-self-end">
              <div className="relative aspect-video w-full max-w-2xl overflow-hidden rounded-4xl bg-linear-to-br from-emerald-100 via-zinc-100 to-indigo-100 p-4">
                <div className="relative h-full overflow-hidden rounded-[1.4rem]">
                  <img
                    src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=80"
                    alt="Students collaborating at a table"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-br from-emerald-100/55 via-white/45 to-indigo-100/65" />

                  <div className="absolute bottom-4 left-4 right-4 rounded-[1.3rem] bg-white/95 p-4 shadow-lg">
                    <div className="absolute bottom-6 left-0 top-6 w-1 rounded-full bg-emerald-400" />
                    <p className="pl-4 text-sm font-semibold leading-relaxed text-slate-800">
                      &ldquo;It started as a hackathon project, but we quickly
                      realized we were solving a friction every group of friends
                      in Itahari faces daily.&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-[230px_1fr]">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-slate-900">
              <span className="h-px w-10 bg-emerald-400" />
              Origin Story
            </h2>
            <div className="space-y-4 text-slate-700">
              <p>
                BaadFaad was born out of a simple observation during busy
                hostels in Nepal: splitting bills after meals is awkward and
                time-consuming. Conversations at the end of every table became
                tense.
              </p>
              <p>
                During the Clash-A-Thon 2026, we decided to tackle this exact
                friction head-on. We built a fast, student-centered app that
                turns confusion into clarity.
              </p>
            </div>
          </section>

          <section className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
            <article className="rounded-3xl bg-white p-7 shadow-sm">
              <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-500">
                <FaCheckCircle />
              </span>
              <h3 className="text-2xl font-bold text-slate-900">Our Mission</h3>
              <p className="mt-3 text-slate-700">
                Remove financial awkwardness from friendships. We believe no one
                should lose a bond over the way a bill is divided.
              </p>
            </article>

            <article className="rounded-3xl bg-white p-7 shadow-sm">
              <span className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-500">
                <FaCheckCircle />
              </span>
              <h3 className="text-2xl font-bold text-slate-900">Our Vision</h3>
              <p className="mt-3 text-slate-700">
                Make every shared meal effortless in Nepal. We&apos;re building
                the infrastructure for a seamless social economy.
              </p>
            </article>
          </section>

          <section className="mt-16 text-center">
            <h2 className="text-4xl font-bold text-slate-900">
              Meet the <span className="text-emerald-700">Minds</span>
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              The team that crafted thought into digital code.
            </p>

            <div className="mt-9 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
              {teamMembers.map((member, index) => (
                <article key={member.name} className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-slate-700 to-slate-900 text-sm font-bold text-white shadow">
                    {member.initials}
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-slate-900">
                    {member.name}
                  </h3>
                  <p
                    className={`text-[11px] font-semibold tracking-wide ${
                      index % 2 === 0 ? "text-emerald-800" : "text-violet-700"
                    }`}
                  >
                    {member.role}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-16 rounded-4xl bg-linear-to-r from-slate-950 via-slate-900 to-indigo-950 px-8 py-12 text-center shadow-xl">
            <h2 className="text-4xl font-bold text-white">
              Ready to split smarter?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-400">
              Join thousands of students in Nepal who are saving friendships one
              dinner bill at a time.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                className="rounded-full bg-emerald-400 px-7 py-3 text-sm font-bold text-slate-900 transition hover:bg-emerald-300"
              >
                Join Beta
              </button>
              <button
                type="button"
                className="rounded-full border border-white/30 px-7 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Contact Us
              </button>
            </div>
          </section>
        </section>
      </main>

      <Footer />
    </div>
  );
}
