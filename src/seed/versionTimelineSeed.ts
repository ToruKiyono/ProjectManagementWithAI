export type VersionTimelineMilestoneType = "iteration" | "progress" | "review" | "release";

export type VersionTimelineMilestoneConfig = {
  weekRange: string;
  dateLabel: string;
  cycleVersion: string;
  label: string;
  milestoneType: VersionTimelineMilestoneType;
  transferProgress: number | null;
};

export type VersionTimelineConfig = {
  versionLine: string;
  releaseVersion: string;
  title: string;
  extraInfo: string;
  milestones: VersionTimelineMilestoneConfig[];
};

export const seedVersionTimelineConfigs: VersionTimelineConfig[] = [
  {
    versionLine: "HC",
    releaseVersion: "7.5.3",
    title: "【HC】7.5.3",
    extraInfo: "(7.3.1->7.5.0->7.5.1->7.5.3)\n分支：master\ntoolkit：0.18.x",
    milestones: [
      { weekRange: "03.03-03.09", dateLabel: "3.9", cycleVersion: "B001", label: "B001（需求转测40%）", milestoneType: "iteration", transferProgress: 40 },
      { weekRange: "03.10-03.16", dateLabel: "3.13", cycleVersion: "B002", label: "B002（需求转测80%）", milestoneType: "iteration", transferProgress: 80 },
      { weekRange: "03.17-03.23", dateLabel: "3.18", cycleVersion: "B003", label: "B003（全量需求转测）", milestoneType: "iteration", transferProgress: 100 },
      { weekRange: "03.17-03.23", dateLabel: "3.20", cycleVersion: "B005", label: "B005", milestoneType: "iteration", transferProgress: null },
      { weekRange: "03.17-03.23", dateLabel: "3.23", cycleVersion: "B006", label: "B006", milestoneType: "iteration", transferProgress: null },
      { weekRange: "03.24-03.30", dateLabel: "3.25", cycleVersion: "B007", label: "B007", milestoneType: "iteration", transferProgress: null },
      { weekRange: "03.24-03.30", dateLabel: "3.28", cycleVersion: "B008", label: "B008", milestoneType: "iteration", transferProgress: null },
      { weekRange: "03.24-03.30", dateLabel: "3.30", cycleVersion: "", label: "发布评审", milestoneType: "review", transferProgress: null }
    ]
  },
  {
    versionLine: "HC",
    releaseVersion: "7.6.0",
    title: "【HC】7.6.0",
    extraInfo: "(7.5.3->7.6.0)\n分支：master\ntoolkit：0.19.x",
    milestones: [
      { weekRange: "03.24-03.30", dateLabel: "3.30", cycleVersion: "B001", label: "B001（需求转测30%）", milestoneType: "iteration", transferProgress: 30 },
      { weekRange: "03.31-04.06", dateLabel: "4.3", cycleVersion: "B002", label: "B002（需求转测50%）", milestoneType: "iteration", transferProgress: 50 },
      { weekRange: "04.07-04.13", dateLabel: "4.10", cycleVersion: "B003", label: "B003（全量需求转测）", milestoneType: "iteration", transferProgress: 100 },
      { weekRange: "04.07-04.13", dateLabel: "4.13", cycleVersion: "B005", label: "B005", milestoneType: "iteration", transferProgress: null },
      { weekRange: "04.14-04.20", dateLabel: "4.15", cycleVersion: "B006", label: "B006", milestoneType: "iteration", transferProgress: null },
      { weekRange: "04.14-04.20", dateLabel: "4.17", cycleVersion: "B007", label: "B007", milestoneType: "iteration", transferProgress: null },
      { weekRange: "04.14-04.20", dateLabel: "4.20", cycleVersion: "B008", label: "B008", milestoneType: "iteration", transferProgress: null },
      { weekRange: "04.21-04.27", dateLabel: "4.24", cycleVersion: "B009", label: "B009", milestoneType: "iteration", transferProgress: null },
      { weekRange: "04.28-05.04", dateLabel: "4.30", cycleVersion: "", label: "发布评审", milestoneType: "review", transferProgress: null }
    ]
  },
  {
    versionLine: "HCSO",
    releaseVersion: "7.5.0-HCSO",
    title: "【HCSO】7.5.0-HCSO",
    extraInfo: "（7.5.0->7.5.0-HCSO）\n分支：7.5.0-HCSO\ntoolkit：0.18.x",
    milestones: [
      { weekRange: "03.03-03.09", dateLabel: "3.9", cycleVersion: "B961", label: "B961", milestoneType: "iteration", transferProgress: null },
      { weekRange: "03.10-03.16", dateLabel: "3.16", cycleVersion: "B962", label: "B962", milestoneType: "iteration", transferProgress: null }
    ]
  },
  {
    versionLine: "HCS",
    releaseVersion: "8.6.1",
    title: "【HCS】8.6.1",
    extraInfo: "（7.5.0->8.6.1）\n分支：HCS-8.6.1\ntoolkit：0.18.x",
    milestones: [
      { weekRange: "03.10-03.16", dateLabel: "3.12", cycleVersion: "B073", label: "B073", milestoneType: "iteration", transferProgress: null }
    ]
  }
];
