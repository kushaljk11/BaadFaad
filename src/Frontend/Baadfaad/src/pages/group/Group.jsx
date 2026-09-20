/**
 * @fileoverview Group Listing Page
 * @description Consumer-facing expense group management page.
 *              Key Features:
 *              - Lists all shared groups the user belongs to
 *              - Polished EmptyState when no groups exist
 *              - Quick navigation to group settlements and bill splitting
 *
 * @module pages/group/Group
 */

import React, { useState, useEffect } from "react";
import { FaPlus, FaUsers, FaArrowRight, FaUserFriends } from "react-icons/fa";
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
    <DashboardShell mainClassName="mx-auto max-w-5xl px-4 py-6 md:ml-56 md:px-8 md:pt-6">
      {/* Header */}
      <section className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
            Shared Expenses
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Your Groups
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Groups for roommates, trips, and ongoing shared expenses.
          </p>
        </div>

        <LoadingButton
          size="md"
          onClick={() => navigate("/split/create?type=group")}
        >
          + Create Group
        </LoadingButton>
      </section>

      {/* Cards */}
      <section className="mt-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs">
            <EmptyState
              icon={FaUserFriends}
              heading="No groups yet"
              description="Create a group for roommates, trips, or regular shared expenses with friends."
              action={
                <LoadingButton
                  size="md"
                  onClick={() => navigate("/split/create?type=group")}
                >
                  Create Your First Group
                </LoadingButton>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <article
                key={group.id || group._id}
                className="group flex flex-col justify-between rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xs transition hover:border-emerald-300 hover:shadow-sm cursor-pointer"
                onClick={() => navigate(`/group/${group.id || group._id}/settlement`)}
              >
                <div>
                  <div className="flex h-36 w-full items-center justify-center rounded-2xl bg-emerald-50 text-3xl font-bold text-emerald-600">
                    {group.name?.[0]?.toUpperCase() || "G"}
                  </div>
                  <h3 className="mt-4 text-base font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                    {group.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                    {group.description || "Active group"}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs">
                  <span className="font-semibold text-slate-500">
                    {group.members?.length || 1} members
                  </span>
                  <span className="font-bold text-emerald-600 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                    View Settlements →
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
