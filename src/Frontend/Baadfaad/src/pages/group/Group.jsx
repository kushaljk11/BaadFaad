/**
 * @fileoverview Group Listing Page
 * @description Displays all expense-sharing groups the user belongs to.
 *              Shows group cards with member count and creation date.
 *              Provides a "Create Group" modal/form and navigation to
 *              individual group settlement and nudge pages.
 *              Uses the Dashboard SideBar + TopBar layout.
 *
 * @module pages/group/Group
 */
import { useState, useEffect } from "react";
import { FaPlus, FaArrowRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import DashboardShell from "../../components/layout/Dashboard/DashboardShell";
import api from "../../config/config";

export default function Group() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        // Fetch all groups then filter to ones the current user belongs to
        const userData = JSON.parse(localStorage.getItem("user") || "{}");
        const userId = userData._id || userData.id;
        const res = await api.get('/groups');
        const payload = res.data;
        let all = Array.isArray(payload) ? payload : payload.data || payload.groups || [];
        if (userId) {
          all = all.filter((g) => {
            const createdBy = g.createdBy?._id || g.createdBy || '';
            if (String(createdBy) === String(userId)) return true;
            const members = g.members || [];
            return members.some((m) => String(m._id || m.id || m) === String(userId));
          });
        }
        setGroups(all);
      } catch (err) {
        console.error("Failed to fetch groups:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, []);

  const handleCalculateSplit = () => {
    navigate("/split/create");
  };
  return (
    <DashboardShell mainClassName="mx-auto max-w-6xl px-6 py-8 md:ml-56 md:px-8 md:pt-8 sm:mt-10">
        {/* Header */}
        <section>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900">Your Group</h1>
              <p className="mt-2 text-sm text-slate-500">
                Tracking items in real-time...
              </p>
            </div>
          </div>
        </section>

        {/* Cards */}
        <section className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            <p className="text-slate-500">Loading groups...</p>
          ) : groups.length === 0 ? (
            <p className="text-slate-500">No groups yet. Create one to get started!</p>
          ) : (
            groups.map((group) => (
              <article
                key={group.id || group._id}
                className="cursor-pointer transition hover:shadow-md"
                onClick={() => navigate(`/group/${group.id || group._id}/settlement`)}
              >
                <div className="relative rounded-[1.8rem] bg-white p-4 shadow-sm">
                  <span className="absolute right-6 top-6 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow">
                    {group.defaultCurrency || "Rs"}
                  </span>
                  {group.image ? (
                    <img
                      src={group.image}
                      alt={group.name}
                      className="h-48 w-full rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-48 w-full items-center justify-center rounded-xl bg-emerald-50 text-4xl text-emerald-400">
                      {group.name?.[0]?.toUpperCase() || "G"}
                    </div>
                  )}
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900">{group.name}</h3>
                <p className="text-sm text-slate-500">{group.description || "No description"}</p>
                <p className="mt-3 text-xs text-slate-400">{group.members?.length || 0} members</p>
              </article>
            ))
          )}

          {/* Add Item Card */}
          <article className="flex flex-col items-center justify-center rounded-[1.8rem] border-2 border-dashed border-zinc-300 p-6 text-center text-slate-400 hover:border-emerald-400 hover:text-emerald-500 transition cursor-pointer"
            onClick={() => {/* Could open a create group modal */}}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-lg">
              <FaPlus />
            </div>
            <p className="mt-3 text-sm font-semibold">Create New Group</p>
          </article>
        </section>

        {/* Bottom Summary */}
        <section className="mt-20">
          <div className="flex items-center justify-between rounded-full bg-slate-900 px-8 py-6 text-white shadow-lg">
            <div className="flex items-center gap-16">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Running Total
                </p>
                <p className="mt-1 text-2xl font-bold">Rs 38.50</p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Tax & Service (15%)
                </p>
                <p className="mt-1 text-lg font-bold text-emerald-400">Rs 5.78</p>
              </div>
            </div>

            <button onClick={handleCalculateSplit} className="flex items-center gap-2 rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-slate-900 hover:bg-emerald-300 transition">
              Calculate Split
              <FaArrowRight className="text-xs" />
            </button>
          </div>
        </section>
    </DashboardShell>
  );
}
