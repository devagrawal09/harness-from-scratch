export default {
  rules: [await Deno.readTextFile("AGENTS.md")],
  skillsDirectory: ".agents/skills",
};
