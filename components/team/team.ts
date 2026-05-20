export type TeamMember = {
  slug: string;
  name: string;
  team: string;
  title: string;
  img: string;
  bio: string;
  education: string[];
};

export const team: TeamMember[] = [
  {
    name: "Amanda Dowell",
    team: "Beauty Ambassadors",
    title: "CEO & Education Director",
    img: "https://srsntfksbi7e9pli.public.blob.vercel-storage.com/images/headshots/Amanda_Headshot.png",
    slug: "amanda",
    bio: "Hey Hey, Friends! I’m Amanda and I’m so grateful that the many haircuts my Barbies endured were worth it! My heart fell for the beauty industry at an early age and my passion has been growing ever since.\n\nThis industry is full of opportunities that are inspiring to everyone and being able to witness learning moments in people that share the same goal as you is adrenalizing! So thankful you’re here!",
    education: ["Redken Artist", "Redken Color Certified", "Licensed Cosmetologist", "Licensed Beauty Culture Educator", "The Salon Professional Academy - Graduate", "Licensed Stylist Since 2019"]
  },
  {
    name: "Lyn White",
    team: "Beauty Ambassadors",
    title: "Co-Founder & Education Director",
    img: "https://srsntfksbi7e9pli.public.blob.vercel-storage.com/images/headshots/Lyn_Headshot.png",
    slug: "lyn",
    bio: "Hello Friends! I’m Lyn and I’m so blessed I have this opportunity to provide you with all things skincare, beauty, and anything glitz and glam to help you grow the self confidence that you want for this industry!\n\nBeauty will forever and always have my heart and I cannot wait to see all of the learning moments we have together! We are so lucky to have you here!",
    education: ["Licensed Cosmetologist", "Licensed Esthetician ", "Licensed Beauty Culture Educator", "The Salon Professional Academy - Graduate"]
  },
  {
    name: "LaDonna Minnis",
    team: "Beauty Ambassadors",
    title: "Educator",
    img: "https://srsntfksbi7e9pli.public.blob.vercel-storage.com/images/headshots/Ladonna_Headshot1.png",
    slug: "ladonna",
    bio: "Hi, I’m Ladonna and one thing you should know about me is that I believe technical excellence leads to artistic freedom. I’m known as a bit of a pixie-cutting queen, precision, shape and confidence are my love language. I’ve spent 20+ years in this industry as a licensed educator; growing behind the chair, educating for Moroccanoil, and educating at beauty schools because education fuels me. My goal is simple, to help every beauty professional to feel empowered, skilled and excited to level up! I’m excited for us to transform together while you remember why you choose this industry in the first place. So glad you are here!",
    education: ["Redken Color Certified", "Licensed Beauty Culture Instructor", "Licensed Cosmetologist", "Graduate of Tri-State Beauty School", "Licensed Stylist since 2003"]
  },
  {
    name: "Chris Bybee",
    team: "Technical Operations",
    title: "Software / Web Developer & Database Administrator",
    img: "https://srsntfksbi7e9pli.public.blob.vercel-storage.com/images/headshots/Chris_Headshot.png",
    slug: "chris",
    bio: "Howdy! I’m Chris, resident jack of all tech…blending the latest in beauty technique and education with modern, user friendly technical design to develop mobile, desktop, and web based software solutions to help stylists…ya know…live their best life!",
    education: ["Bachelors of Science in Computer Science"]
  },
  {
    name: "Caden Potts",
    team: "Technical Operations",
    title: "Video / Photo Editor",
    img: "https://srsntfksbi7e9pli.public.blob.vercel-storage.com/images/headshots/Caden_Headshot.jpg",
    slug: "caden",
    bio: "",
    education: []
  },
  {
    name: "Morgan",
    team: "Technical Operations",
    title: "Hooman Resources / Mascot",
    img: "https://srsntfksbi7e9pli.public.blob.vercel-storage.com/images/headshots/Morgan_Headshot.png",
    slug: "morgan",
    bio: "Bork.",
    education: ["Certified Sniffer", "Bachelors of Borking (Backyard University)"]
  },
];

export function getTeamMember(slug: string) {
  return team.find((m) => m.slug === slug);
}