/**
 * @fileoverview Landing Page Footer
 * @description Site-wide footer displayed on all landing/marketing pages.
 *              Contains the BaadFaad brand section with tagline, social links,
 *              navigation links (About, Features, Contact, Privacy),
 *              community links (Help, Clash-A-Thon, API, Brand Assets),
 *              and legal boilerplate (Terms, Cookies, Copyright).
 *
 * @returns {JSX.Element} Full-width dark footer with three-column grid
 *
 * @module components/layout/landing/Footer
 */
import logo from '@root-assets/Logo-01.png'

export default function Footer() {
    return (
        <footer className="relative w-full bg-slate-950 px-6 py-14 text-slate-300 sm:px-10 lg:px-16">
            <div className="mx-auto w-full max-w-6xl">
                <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
                    <div>
                        <div className="mb-6 flex items-center gap-3">
                            <img
                                src={logo}
                                alt="BaadFaad logo"
                                className="h-8 w-8 object-cover"
                            />
                            <h3 className="text-2xl font-bold text-white">BaadFaad</h3>
                        </div>
                        <p className="max-w-sm text-lg leading-relaxed text-slate-400">
                            Making finance social and friction-free for the next generation of Nepali youth.
                            Built with love in Kathmandu.
                        </p>

                        <div className="mt-8 flex items-center gap-4">
                            <button
                                type="button"
                                className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 text-lg text-slate-400 transition hover:border-slate-500 hover:text-white"
                                aria-label="Dribbble"
                            >
                                ◉
                            </button>
                            <button
                                type="button"
                                className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 text-lg text-slate-400 transition hover:border-slate-500 hover:text-white"
                                aria-label="X"
                            >
                                @
                            </button>
                        </div>
                    </div>

                    <div>
                        <h4 className="mb-4 text-xl font-semibold text-white">Links</h4>
                        <ul className="space-y-3 text-sm text-slate-400">
                            <li><a href="#about" className="hover:text-white">About Us</a></li>
                            <li><a href="#features" className="hover:text-white">Features</a></li>
                            <li><a href="#contact" className="hover:text-white">Contact</a></li>
                            <li><a href="#privacy" className="hover:text-white">Privacy Policy</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="mb-4 text-xl font-semibold text-white">Community</h4>
                        <ul className="space-y-3 text-sm text-slate-400">
                            <li><a href="#help" className="hover:text-white">Help Center</a></li>
                            <li><a href="#clashathon" className="hover:text-white">Clash-A-Thon 2026</a></li>
                            <li><a href="#api" className="hover:text-white">Developer API</a></li>
                            <li><a href="#assets" className="hover:text-white">Brand Assets</a></li>
                        </ul>
                    </div>
                </div>

                <div className="mt-14 border-t border-slate-800 pt-8">
                    <div className="flex flex-col gap-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                        <p>© 2026 BaadFaad Inc. All rights reserved.</p>
                        <div className="flex items-center gap-6">
                            <a href="#terms" className="hover:text-slate-300">Terms of Service</a>
                            <a href="#cookies" className="hover:text-slate-300">Cookie Policy</a>
                        </div>
                    </div>
                </div>
            </div>

            
        </footer>
    );
}
