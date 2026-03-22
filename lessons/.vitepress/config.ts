import { defineConfig } from "vitepress";

export default defineConfig({
  title: "AI Engineering Fundamentals",
  description: "Course notes for the AI Engineering workshop",
  themeConfig: {
    sidebar: [
      {
        text: "Lessons",
        items: [
          {
            text: "01. Intro to AI Engineering",
            link: "/01-intro-to-ai-engineering/",
          },
          {
            text: "02. Your First Cloudflare Agent",
            link: "/02-your-first-cloudflare-agent/",
          },
          {
            text: "03. The Chat Experience",
            link: "/03-the-chat-experience/",
          },
          {
            text: "04. The Eval Discipline",
            link: "/04-the-eval-discipline/",
          },
          {
            text: "05. Automated Scorers",
            link: "/05-automated-scorers/",
          },
          {
            text: "06. Context Engineering",
            link: "/06-context-engineering/",
          },
          {
            text: "07. Advanced Tool Use",
            link: "/07-advanced-tool-use/",
          },
          { text: "08. RAG", link: "/08-rag/" },
          { text: "09. Gen UI", link: "/09-gen-ui/" },
          {
            text: "10. Human in the Loop",
            link: "/10-human-in-the-loop/",
          },
          {
            text: "11. Agent Architectures",
            link: "/11-agent-architectures/",
          },
          {
            text: "12. The Data Flywheel",
            link: "/12-the-data-flywheel/",
          },
        ],
      },
    ],
  },
});
