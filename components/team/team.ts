export type TeamMember = {
  slug: string;
  name: string;
  team: string;
  title: string;
  img: string;
  bio: string;
};

export const team: TeamMember[] = [
  {
    name: "Kelsey Ramsey",
    team: "Coaching Staff",
    title: "Owner & Coach",
    img: "/images/headshots/kelsey_headshot.png",
    slug: "kelsey",
    bio: "Hi everyone! My name is Kelsey, and I am the owner and coach at Limitless Cheer Co. I have over 10 years of experience in cheerleading and 3 years of coaching experience working with athletes of all ages and skill levels. I am a positive, high-energy coach who is passionate about helping athletes grow both on and off the mat. I truely care about each athlete and strive to create a supportive, motivating, and fun environment where every child can build confidence, skills, and love for the sport!",
  },
  {
    name: "Hannah Myler",
    team: "Coaching Staff",
    title: "Assistant Cheer Director & Coach",
    img: "/images/headshots/hannah_headshot.png",
    slug: "hannah",
    bio: "With 17 years of competitive cheer experience and 12 years of coaching and instruction, I am dedicated to my career developing athletes of all ages and skill levels. I have coached teams ranging from tiny athletes through senior divisions; focusing on building strong technique, confidence, discipline, and teamwork. Passionate about athlete growth, I bring energy, leadership, and experience to every practice and performance.",
  },
  {
    name: "Kayla Parker",
    team: "Coaching Staff",
    title: "Assistant Cheer Director & Coach",
    img: "/images/headshots/kayla_headshot.png",
    slug: "kayla",
    bio: "With over 14 years of cheerleading experience, I bring passion, leadership, and dedication to every athlete I coach. My background includes 3 years of coaching experience during high school and began to coach 2 years ago after graduating from college. My passion is helping athletes grow both on and off the mat. My goal is to create a positive and encouraging environment. I strive to build confidence, teamwork, and resilience. I believe strong athletes are built through support, communication, discipline, and encouragement.",
  },
  {
    name: "Wynne Curtsinger",
    team: "Coaching Staff",
    title: "Assistant Cheer Director & Coach",
    img: "/images/headshots/wynne_headshot.jpg",
    slug: "wynne",
    bio: "",
  },
  {
    name: "Cami Boling",
    team: "Coaching Staff",
    title: "Coach",
    img: "/images/headshots/cami_headshot.png",
    slug: "cami",
    bio: "Hi I'm coach Cami! My life has always been around cheer. I grew up in cheer. I was a gymnastics instructor, and have been the minis' instructor for 7 years.",
  },
  {
    name: "Madison Newby",
    team: "Coaching Staff",
    title: "Coach",
    img: "/images/headshots/madison_headshot.png",
    slug: "madison",
    bio: "Hi I'm coach Madison! I bring 14 years of cheer experience and a true passion for the sport. Throughout my cheer journey I have participated in competitive cheer at multiple levels, as well as high school competitive and sideline cheerleading. As a new addition to the program last year, I am excited to begin my first full season with the team! I love encouraging and supporting my athletes both on and off the mat. I am dedicated to helping each cheerleader build confidence, develop their skills, and reach their full potential. As a coach, I strive to be a positive role model and create an environment where every athlete feels motivated, valued, and empowered to succeed.",
  },
];

export function getTeamMember(slug: string) {
  return team.find((m) => m.slug === slug);
}