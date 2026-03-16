"use client";

interface Program {
  id: string;
  name: string;
  description?: string;
  image?: string;
  // Add more fields as needed
}

interface ProgramDetailProps {
  program: Program;
}

export default function ProgramDetail({ program }: ProgramDetailProps) {
  return (
    <div className="program-detail">
      <h1>{program.name}</h1>
      {program.description && <p>{program.description}</p>}
      {/* Detail implementation coming soon */}
    </div>
  );
}
