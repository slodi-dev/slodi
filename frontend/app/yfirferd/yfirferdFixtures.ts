/**
 * Story fixtures for Yfirferð. Only imported by `*.stories.tsx` in this folder.
 */
import type { AuthorStanding, Suspension } from "@/services/suspensions.service";
import type { ReviewDetail } from "@/services/moderation.service";
import type { MockRoute } from "@/.storybook/mocks/fetch";
import { programRatleikur, userMember, userModerator } from "@/stories/fixtures";

export const standingClean: AuthorStanding = {
  author_id: userMember.id,
  reports_received: 0,
  strikes: 0,
  suspensions: [],
  active_suspension: null,
};

const pastSpell: Suspension = {
  id: "s-1",
  user_id: userMember.id,
  starts_at: "2026-06-02T10:00:00Z",
  expires_at: "2026-06-09T10:00:00Z",
  reason: "Endurtekið auglýsingaefni í bankanum",
  lifted_at: null,
  lift_reason: null,
  issued_by_name: userModerator.name,
  lifted_by_name: null,
  is_active: false,
};

export const standingWithHistory: AuthorStanding = {
  author_id: userMember.id,
  reports_received: 4,
  strikes: 2,
  suspensions: [pastSpell],
  active_suspension: null,
};

const activeSpell: Suspension = {
  ...pastSpell,
  id: "s-2",
  starts_at: "2026-10-05T10:00:00Z",
  expires_at: "2026-11-04T10:00:00Z",
  reason: "Óöruggar leiðbeiningar eftir fyrri áminningu",
  is_active: true,
};

export const standingSuspended: AuthorStanding = {
  ...standingWithHistory,
  strikes: 3,
  suspensions: [activeSpell, pastSpell],
  active_suspension: activeSpell,
};

export const standingOpenEnded: AuthorStanding = {
  ...standingSuspended,
  suspensions: [{ ...activeSpell, expires_at: null }, pastSpell],
  active_suspension: { ...activeSpell, expires_at: null },
};

export function standingRoute(standing: AuthorStanding): MockRoute {
  return { match: /\/moderation\/authors\/[^/]+\/standing/, body: standing };
}

export const reviewDetail: ReviewDetail = {
  id: programRatleikur.id,
  content_type: "event",
  name: programRatleikur.name,
  description: programRatleikur.description,
  instructions:
    "Stöð 1: finnið norður með áttavita. Stöð 2: lesið hæðarlínur á kortinu. Stöð 3: leysið gátuna á bekknum við tjörnina.",
  author_id: userMember.id,
  author_name: userMember.name,
  created_at: "2026-10-03T14:20:00Z",
  review_state: "unreviewed",
  hidden_at: null,
  review_note: null,
  open_report_count: 0,
  open_report_reasons: [],
  author_strikes: 0,
  reviewed_by_name: null,
  reviewed_at: null,
  equipment: programRatleikur.equipment ?? null,
  duration_min: 60,
  duration_max: 90,
  prep_time_min: 30,
  prep_time_max: 60,
  count_min: 6,
  count_max: 40,
  price: 500,
  location: programRatleikur.location ?? null,
  age: ["Fálkaskátar", "Dróttskátar"],
  image: programRatleikur.image,
  tags: ["útivist", "rötun", "náttúra"],
  workspace_id: "ws-1",
  reports: [],
  review_comments: [],
  documents: [{ name: "Þrautablað.pdf", url: "#thrautablad", content_type: "application/pdf" }],
  author_reports_received: 0,
  author_suspension_count: 0,
  author_suspended_until: null,
};
