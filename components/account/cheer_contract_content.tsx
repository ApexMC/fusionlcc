import Image from "next/image"
import type { ReactNode } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type CostRow = [item: string, amount: string, notes?: string]

const staff = [
  {
    name: "Kelsey Ramsey - Owner/Coach",
    biography:
      "Kelsey’s cheer background extends back 15 years, when she began cheering in elementary school. She began gymnastics at the age of 5 and joined Fusion at the age of 13. She was trained by Fusion staff at the age of 16 and worked as a gymnastics instructor for 2 years. Before owning Limitless, she coached junior high cheer at Tell City.",
  },
  {
    name: "Hannah Myler - Coach",
    biography:
      "Hannah has been with Fusion for 16 years. She began as a student at the age of 7 and later became a junior coach. After high school, she stayed with the gym and has coached both gymnastics and cheer. She is very educated in stunting, tumbling, and routine formations.",
  },
  {
    name: "Kayla Parker - Coach",
    biography:
      "Kayla’s cheer background extends back to a very young age. She began tumbling with Fusion in 2014 and later joined the competitive cheer team. Later, she came back to coach. Kayla is an expert in stunting, routine counts, and routine formations.",
  },
  {
    name: "Cami Boling - Coach",
    biography:
      "Cami began cheer and gymnastics at a young age. She has been with the gym for over 10 years and has participated as both a gymnast and a competitive cheerleader. Cami is very knowledgeable in all aspects of competitive cheer and is our novice/tiny teams expert.",
  },
  {
    name: "Lanie Mullis - Coach",
    biography:
      "Lanie began cheer and gymnastics as a child. She was a junior coach here at LCC and has decided to continue her coaching journey with us. Lanie is knowledgeable in basing grips as well as routine timing.",
  },
  {
    name: "Madison Newby - Coach",
    biography:
      "Madison was new to coaching last season but is not new to competitive cheerleading. With her positive attitude, she brings knowledge in timing, routine counts, and several years of competitive cheer experience.",
  },
  {
    name: "Junior Coaches",
    biography:
      "You may see some of our athletes helping out as well. These junior coaches are experienced and were hand-picked by adult staff to help with the teams. They are trained and safe.",
  },
]

const teamLevels = [
  {
    name: "Novice",
    details: [
      ["Best for", "Beginners or athletes who are new to competitive cheer."],
      ["Commitment", "Low to moderate commitment with 1-2 practices per week for 1-1.5 hours."],
      ["Competition / focus", "Competitions are local and low pressure. Teams are scored but not ranked by the judging panel."],
      ["Financial commitment", "Less financial commitment."],
      ["Level goal", "Introduce athletes to competitive cheer while having fun!"],
    ],
  },
  {
    name: "Prep",
    details: [
      ["Best for", "Athletes with some cheer experience or those who want to advance their skills without the pressure of elite competitions."],
      ["Commitment", "Moderate commitment with 1-2 practices a week for 2 hours."],
      ["Competition / focus", "Teams focus on skill progression and routine execution while focusing on quality of cheer routines. Most competitions are local but can be regional or national; teams are scored and ranked by a judges panel at competitions."],
      ["Financial commitment", "Moderate costs, with less costly uniforms and choreography (if any choreography fee applies)."],
    ],
  },
  {
    name: "Elite",
    details: [
      ["Best for", "Experienced athletes who are ready to be committed to high-level competitive cheerleading."],
      ["Commitment", "Higher commitment with 2-3 practices a week for 2 hours each, as well as conditioning and choreography sessions."],
      ["Competition / focus", "Focuses on advanced skills, precision of routine, and a high level of excellence in execution. Competitions are regional and potentially national."],
      ["Financial commitment", "High financial commitment with premium uniform and professional choreography."],
      ["Level goal", "Instilling discipline and dedication in order to achieve the highest level of success at competitions."],
    ],
  },
]

const attendancePolicies = [
  "Athletes are allowed to participate in school sports, but practices missed should be as limited as possible.",
  "Athletes are allowed 4 excused practices per season and 2 unexcused practices. Practices are excused for reasons such as major illness or injury, family death, family wedding, or a game for a school sport. Travel sports are not excused. Work is also unexcused.",
  "All absences must be submitted on the Google Doc form.",
  "Gymnastics is also mandatory for cheerleaders, and the same attendance policy applies.",
  "Students/Athletes are not allowed, under any circumstance, to participate in activities such as smoking, vaping, the use of illegal substances, drugs, pills not prescribed to them by a physician, or drinking. These acts will result in punishments such as sitting out of competitions or possible elimination from the program.",
  "Late Pick Up Fee - We understand things happen. Always feel free to message your coach when you’re going to be late to pick up your child. We will start charging a $5 fee if you’re later than 15 minutes to pick up your child. We have other teams and classes to get to, and we cannot legally leave your child unsupervised while we coach.",
  "Practice Wear - Your team will have a designated color to wear to practice. Athletes are expected to wear black shorts and the color shirt they are assigned, along with their black cheer shoes.",
  "Injury Policy - If your child is injured, they will have to supply a doctor’s note and a release note to the coaches. While they are injured, they are still expected to be at practice with their team to show engagement and so they know all changes and can jump right back in upon their return. Absences can be discussed with the coaches and may be excused at the coaches’ discretion; otherwise, the absence will count as unexcused.",
]

const eliteCosts: CostRow[] = [
  ["Choreography", "Estimated $340 / athlete", "Due June 1. Amount is estimated until final teams are created."],
  ["Clean-up fee", "$90", "Due September 1."],
  ["Uniform", "About $300 / athlete", "Can be fundraised. If your child has a uniform from last season, this cost does not apply."],
  ["Shoes", "Around $60", "Brand may vary. Shoes must be black cheer shoes; black tennis shoes do not qualify."],
  ["Bows", "$36"],
  ["Monthly tuition", "$110", "Due on the 1st of every month."],
  ["Competition fees", "$110", "Due on the 15th of every month; can be fundraised."],
  ["Music for routines", "$50"],
  ["Coaches fees", "$75"],
  ["Banquet fee", "$5"],
]

const prepCosts: CostRow[] = [
  ["Choreography", "Estimated $340 / athlete", "Includes the initial summer choreography. Due June 1. Amount is estimated until final teams are created."],
  ["Clean-up fee", "Estimated $90 / athlete", "Due September 1."],
  ["Monthly tuition", "$90", "Due on the 1st of every month."],
  ["Competition fees", "$90", "Due on the 15th of every month; can be fundraised."],
  ["Uniform", "Around $300", "Same as Elite."],
  ["Bows", "$36"],
  ["Shoes", "Around $50", "Depending on brand."],
  ["Music", "$40", "Due June 1."],
  ["Coaches fee", "$50"],
  ["Banquet fee", "$5"],
]

const noviceCosts: CostRow[] = [
  ["Monthly tuition", "$65", "Due on the 1st of every month."],
  ["Competition fees", "$65", "Due on the 15th of every month; can be fundraised."],
  ["Uniform", "$125"],
  ["Bows", "$36"],
  ["Shoes", "$40"],
  ["Music", "$40"],
  ["Choreography", "$50"],
  ["Coaches fee", "$50"],
  ["Banquet fee", "$5"],
]

const competitionDates = {
  Elite: [
    "11/22 - Apex, Owensboro",
    "12/5 - Global, Owensboro",
    "1/9-1/10 - MCDA, French Lick",
    "1/23-1/24 - Royal, Owensboro",
    "2/6 - All Out, Indy",
    "2/20-2/21 - Deep South, Cincinnati",
    "Tentative: 3/13-3/14 - Wave/GMCE, French Lick",
    "End of season",
  ],
  Prep: [
    "12/5 - Global, Owensboro",
    "1/9-1/10 - MCDA, French Lick",
    "1/23-1/24 - Royal, Owensboro",
    "2/6 - All Out, Indy",
    "3/13-3/14 - Wave/GMCE, French Lick",
  ],
  Novice: [
    "12/5 - Global, Owensboro",
    "1/9-1/10 - MCDA, French Lick",
    "1/23-1/24 - Royal, Owensboro",
  ],
}

function ContractSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="border-b border-pink-400 pb-2 text-xl font-bold uppercase tracking-tight text-green-800 dark:text-green-300">
        {title}
      </h2>
      {children}
    </section>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-6">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function CostTable({ rows }: { rows: CostRow[] }) {
  return (
    <Table className="min-w-[42rem]">
      <TableHeader className="bg-green-800 text-white">
        <TableRow className="hover:bg-green-800">
          <TableHead className="w-1/3 text-white">Item</TableHead>
          <TableHead className="w-1/3 text-white">Amount</TableHead>
          <TableHead className="w-1/3 text-white">Due / Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(([item, amount, notes]) => (
          <TableRow key={item}>
            <TableCell className="whitespace-normal align-top font-medium">
              {item}
            </TableCell>
            <TableCell className="whitespace-normal align-top">{amount}</TableCell>
            <TableCell className="whitespace-normal align-top">
              {notes ?? ""}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function CheerContractContent() {
  return (
    <article className="mx-auto max-w-4xl space-y-8 bg-background px-1 py-2 text-sm leading-6 text-foreground sm:px-4">
      <header className="flex flex-col items-center text-center">
        <Image
          src="/images/logos/limitless_logo.png"
          alt="Limitless Cheer Co."
          width={220}
          height={160}
          className="h-auto w-44 sm:w-52"
        />
        <h1 className="mt-3 text-2xl font-bold uppercase text-green-800 dark:text-green-300 sm:text-3xl">
          Limitless Cheer Co.
        </h1>
        <p className="mt-1 font-semibold uppercase italic text-pink-500">
          2026-2027 Season Contract
        </p>
      </header>

      <ContractSection title="Vision & Goals">
        <p>
          Our program works to build athletes who are strong and confident by
          progressing their abilities in a positive and encouraging environment.
          We strive to build athletes with positive character and will work to
          help build quality core values through our love for the sport of
          competitive cheer.
        </p>
      </ContractSection>

      <ContractSection title="About Us">
        <p>
          Welcome to year two of Limitless Cheer Co! We are so extremely excited
          to be here and cannot thank you enough for choosing us and trusting us
          with your children. Athletes of all skill levels are welcome and will
          have a spot on a team!
        </p>
      </ContractSection>

      <ContractSection title="Meet the Staff">
        <div className="space-y-4">
          {staff.map((member) => (
            <div key={member.name}>
              <h3 className="font-semibold text-pink-500">{member.name}</h3>
              <p className="mt-1 pl-4">{member.biography}</p>
            </div>
          ))}
        </div>
      </ContractSection>

      <ContractSection title="Teams and Levels">
        <div className="space-y-4">
          {teamLevels.map((level) => (
            <section key={level.name} className="rounded-lg bg-muted/60 p-4">
              <h3 className="text-lg font-bold uppercase text-pink-500">
                {level.name}
              </h3>
              <dl className="mt-2 space-y-1">
                {level.details.map(([label, description]) => (
                  <div key={label}>
                    <dt className="inline font-semibold text-green-800 dark:text-green-300">
                      {label}: {" "}
                    </dt>
                    <dd className="inline">{description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </ContractSection>

      <ContractSection title="Athlete Placement">
        <BulletList
          items={[
            "We are very focused on helping each individual excel to the best of their ability and helping them realize their full potential. We firmly believe that our success originates from the dedication and commitment of our athletes and parents.",
            "We encourage positive attitudes and respectful behavior within the LCC program. We carefully consider each athlete and their team placement. Ultimately, our goal is to place your athlete where they will grow with self-confidence and be the best that they can be! A team cannot be successful without individual greatness.",
            "There may be athletes on any team who tumble at different levels; this is standard as a small gym. Athletes will also be placed based on their abilities to stunt, jump, and dance.",
          ]}
        />
        <h3 className="pt-2 text-base font-bold text-green-800 dark:text-green-300">
          Age Groups
        </h3>
        <BulletList
          items={[
            "Some ages differ for Elite/Prep.",
            "Novice-Tiny: 2018-2022",
            "Tiny: 2018-2020",
            "Mini: 2016 and later",
            "Youth: 2012 and later",
            "Junior: 2009 and later",
            "Senior: 2006-2015",
          ]}
        />
        <h3 className="pt-2 text-base font-bold text-green-800 dark:text-green-300">
          Tumbling Skills by Level: Prep and Elite
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Level 1", ["Forward roll or handstand roll", "Cartwheels, round-offs, backbends", "Back walkovers, front walkovers"]],
            ["Level 2", ["Standing back handspring", "Round-off back handspring; front handspring", "Front walkover series"]],
            ["Level 3", ["Standing back handspring series", "Round-off back handspring tuck and round-off tuck", "Aerial, punch front"]],
            ["Level 4", ["Standing tuck and back handspring tuck", "Round-off back handspring layout plus forward skill connection"]],
            ["Level 5", ["Jump tuck; 2 to a layout", "Round-off back handspring full; any forward series connection"]],
          ].map(([level, skills]) => (
            <section key={level as string}>
              <h4 className="font-semibold text-pink-500">{level}</h4>
              <BulletList items={skills as string[]} />
            </section>
          ))}
        </div>
      </ContractSection>

      <ContractSection title="Attendance Policy / Conduct">
        <BulletList items={attendancePolicies} />
      </ContractSection>

      <ContractSection title="Cost">
        <p>
          Transparency of costs and payments is a high priority of this gym. You,
          as a payer, have the right to know what you are paying for and when you
          are paying for it. PLEASE ask Kelsey ANY questions about costs. IT IS
          HIGHLY ENCOURAGED!
        </p>
        <section className="rounded-lg bg-pink-100 p-4 text-zinc-950 dark:bg-pink-950/40 dark:text-zinc-50">
          <h3 className="font-bold uppercase text-green-800 dark:text-green-300">
            Midseason Withdrawal / Quitting Fee
          </h3>
          <p className="mt-1">
            There is a $350 quitting fee if you/your child decides to quit
            midseason. This fee will go toward reworking the routine. If the
            uniform has not been paid for by the parent, the uniform must also be
            returned to the gym. This applies to every athlete on a Prep team or
            higher.
          </p>
        </section>

        <section className="space-y-3 pt-2">
          <h3 className="text-lg font-bold text-green-800 dark:text-green-300">
            Elite Teams
          </h3>
          <p className="font-semibold">
            Estimated season total: around $3,000. This estimate includes a
            combination of standalone season costs and payments made to the gym.
          </p>
          <CostTable rows={eliteCosts} />
          <h4 className="font-bold text-green-800 dark:text-green-300">
            Elite Costs Not Included
          </h4>
          <BulletList
            items={[
              "Travel expenses such as gas, food, and housing for competitions.",
              "Family fees for competitions (entry fees).",
              "If Elite teams attend an end-of-season event such as Small Gym Show Down in Alabama or Florida Finals, this is an ADDITIONAL COST and is not included in any of the prices above.",
            ]}
          />
        </section>

        <section className="space-y-3 pt-2">
          <h3 className="text-lg font-bold text-green-800 dark:text-green-300">
            Prep Teams
          </h3>
          <p className="font-semibold">
            Estimated season total: around $2,550. This estimate includes a
            combination of standalone costs and costs paid to the gym. Recurring
            payments are $90 on the 1st and $90 on the 15th of each month; the
            payment on the 15th can be fundraised.
          </p>
          <CostTable rows={prepCosts} />
        </section>

        <section className="space-y-3 pt-2">
          <h3 className="text-lg font-bold text-green-800 dark:text-green-300">
            Novice Teams
          </h3>
          <p className="font-semibold">
            Estimated season total: around $1,600. This estimate includes a
            combination of standalone costs and costs paid to the gym. Recurring
            payments are $65 on the 1st and $65 on the 15th of each month; the
            payment on the 15th can be fundraised.
          </p>
          <CostTable rows={noviceCosts} />
        </section>
      </ContractSection>

      <ContractSection title="Schedule">
        <h3 className="text-base font-bold text-green-800 dark:text-green-300">
          Practices
        </h3>
        <BulletList items={["Practices will begin July 6th."]} />
        <section className="rounded-lg bg-green-100 p-4 text-zinc-950 dark:bg-green-950/40 dark:text-zinc-50">
          <h4 className="font-bold uppercase text-green-800 dark:text-green-300">
            Mandatory Summer Choreography
          </h4>
          <p className="mt-1">
            Summer choreography is around June 13-21 and is mandatory for all
            teams unless prior arrangements are made.
          </p>
        </section>
        <BulletList
          items={[
            "Elite teams will practice two times a week on Mondays and Thursdays for two hours each day through the month of July, then will switch to Sundays and Mondays beginning August 9th.",
            "A third practice might be added the week before competitions if the coaches deem it necessary.",
            "Prep teams will practice every Monday and every other Thursday for 1.5 hours each day through the month of July, then will switch to every Monday and every other Sunday beginning August 9th.",
            "An additional practice may be added the week before a competition if coaches deem it necessary.",
            "Novice teams will practice once a week on Mondays for 1 hour.",
            "A second practice may be added the week before a competition if coaches deem it necessary.",
          ]}
        />
        <h3 className="pt-2 text-base font-bold text-green-800 dark:text-green-300">
          Competitions
        </h3>
        <section className="rounded-lg bg-pink-100 p-4 text-zinc-950 dark:bg-pink-950/40 dark:text-zinc-50">
          <h4 className="font-bold uppercase text-green-800 dark:text-green-300">
            Dates Subject to Change
          </h4>
          <p className="mt-1">
            Competition dates are subject to change due to cost or event
            cancellation.
          </p>
        </section>
        <Table className="min-w-[42rem]">
          <TableHeader className="bg-green-800 text-white">
            <TableRow className="hover:bg-green-800">
              {Object.keys(competitionDates).map((team) => (
                <TableHead key={team} className="w-1/3 text-center text-white">
                  {team}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              {Object.values(competitionDates).map((dates, index) => (
                <TableCell
                  key={Object.keys(competitionDates)[index]}
                  className="whitespace-normal align-top"
                >
                  <BulletList items={dates} />
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </ContractSection>

      <ContractSection title="Tryout Information">
        <p>
          Tryouts are actually just an evaluation of the child’s skills so the
          coaches know where to place them. Every child will make a team, no
          matter their skill level!
        </p>
        <p>
          All students should wear a plain black shirt and plain black shorts
          with their cheer shoes if they have them.
        </p>
        <Table className="min-w-[42rem]">
          <TableHeader className="bg-green-800 text-white">
            <TableRow className="hover:bg-green-800">
              {[
                "Group",
                "Age",
                "Warm Up",
                "Tryouts",
              ].map((heading) => (
                <TableHead key={heading} className="text-center text-white">
                  {heading}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              ["Tiny/Novice Age Groups", "5-7 yrs old", "12:00 PM - Warm up", "12:30 PM - Tryouts begin"],
              ["Mini-Youth", "8-11 yrs old", "2:30 PM - Warm up", "3:00 PM - Tryouts begin"],
              ["Junior-Senior", "12+ yrs old", "4:00 PM - Warm up", "4:30 PM - Tryouts begin"],
            ].map((row) => (
              <TableRow key={row[0]}>
                {row.map((cell) => (
                  <TableCell key={cell} className="whitespace-normal text-center">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ContractSection>

      <ContractSection title="Contract Acknowledgement">
        <p className="text-base leading-7">
          I have read the contract above and understand my responsibilities as
          an athlete/parent. I will comply with this contract to the best of my
          ability. I understand that the prices listed, as well as dates of
          practices and competitions, are subject to change within reason.
        </p>
      </ContractSection>
    </article>
  )
}
