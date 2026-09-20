/**
 * @fileoverview Mobile-First Group Listing Page
 * @description Mobile-optimized group expense management page:
 *              - Compact group cards with 14-16px padding
 *              - Direct 1-tap settlement access
 *              - Thumb-friendly creation CTA
 *
 * @module pages/group/Group
 */

import React, { useState, useEffect } from "react";
import { FaPlus, FaUsers, FaUserFriends } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import DashboardShell from "../../components/layout/Dashboard/DashboardShell";
import api from "../../config/config";
import { EmptyState, SkeletonCard } from "../../components/common/primitives";
import LoadingButton from "../../components/common/LoadingButton";

export default function Group() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const userData = JSON.parse(localStorage.getItem("user") || "{}");
        const userId = userData._id || userData.id;
        const res = await api.get("/groups");
        const payload = res.data;
        let all = Array.isArray(payload) ? payload : payload.data || payload.groups || [];
        if (userId) {
          all = all.filter((g) => {
            const createdBy = g.createdBy?._id || g.createdBy || "";
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

  return (
    <DashboardShell>
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5">
        {/* Header */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900">
              Your Groups
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Shared groups for roommates, trips, and recurring expenses.
            </p>
          </div>

          <div className="w-full sm:w-auto">
            <LoadingButton
              fullWidth={false}
              size="md"
              icon={<FaPlus className="text-xs" />}
              onClick={() => navigate("/split/create?type=group")}
            >
              Create Group
            </LoadingButton>
          </div>
        </section>

        {/* Cards */}
        <section>
          {loading ? (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              <SkeletonCard lines={4} />
              <SkeletonCard lines={4} />
              <SkeletonCard lines={4} />
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-2xs">
              <EmptyState
                icon={FaUserFriends}
                heading="No groups yet"
                description="Create a group for roommates, trips, or regular shared expenses with friends."
                action={
                  <LoadingButton
                    size="md"
                    icon={<FaPlus className="text-xs" />}
                    onClick={() => navigate("/split/create?type=group")}
                  >
                    Create Your First Group
                  </LoadingButton>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => {
                const initial = group.name?.[0]?.toUpperCase() || "G";
                const memberCount = group.members?.length || 1;

                return (
                  <article
                    key={group.id || group._id}
                    className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5 shadow-2xs transition-all hover:border-emerald-300 hover:shadow-xs cursor-pointer min-h-30 touch-manipulation active:scale-[0.99]"
                    onClick={() => navigate(`/group/${group.id || group._id}/settlement`)}
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-150 text-base font-semibold">
                          {initial}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-semibold text-slate-900 group-hover:text-emerald-800 transition-colors truncate">
                            {group.name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                            <FaUsers className="text-[11px] text-slate-400" />
                            <span>{memberCount} {memberCount === 1 ? "member" : "members"}</span>
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {group.description || "Active expense group"}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs">
                      <span className="inline-flex items-center gap-1.5 text-slate-500 text-[11px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                      <span className="font-semibold text-emerald-800 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                        Settlements →
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
