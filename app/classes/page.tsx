import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import ClassCard from "@/components/classes/class_card";

export default function ClassSchedules() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-100 dark:bg-zinc-900 font-sans">
      <main className="flex min-h-[50vh] flex-1 w-full flex-col items-center py-16 px-8 md:px-16 justify-center bg-zinc-100 dark:bg-zinc-900">
        <h1 className="text-4xl font-bold text-zinc-800 dark:text-zinc-200 text-center mx-auto">
          Classes
        </h1>
        <p className=" max-w-2xl text-center text-zinc-600 dark:text-zinc-400 mt-4 mb-12">
          <span className="text-orange-400">Placement Note:</span> Athletes may be evaluated by our coaching staff to ensure placement in the class that best suits their current skill level and supports safe, successful progression.
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          <ClassCard
            imageSrc={"/images/classes/class_1.png"}
            imageAlt={"test"}
            className={"Me + 1 (2yr)"}
            slug={"me-1-2yr"}
            price={48}
            duration={30}
            description={"Designed for our youngest athletes, this class introduces basic movement, coordination, and tumbling skills in a fun supportive environment. A parent or guardian participates alongside their child, helping guide them through activities with intruction and encouragement from our coaching staff."}
            imagePosition="left"
          />
          <ClassCard
            imageSrc={"/images/classes/class_2.png"}
            imageAlt={"test"}
            className={"Me + 1 (3-4yr)"}
            slug={"me-1-3-4yr"}
            price={48}
            duration={30}
            description={"This class is perfect for preschool-aged athletes who still benefit from parent participation. Children will build confidence, body awareness, and foundational tumbling skills while working together with a parent or guardian and receiving guidance from our instructors."}
            imagePosition="right"
          />
          <ClassCard
            imageSrc={"/images/classes/class_3.png"}
            imageAlt={"test"}
            className={"Preschool"}
            slug={"preschool"}
            price={48}
            duration={40}
            description={"For independent preschoolers who are ready to participate without parent assistance. Athletes will learn basic tumbling, coordination, listening skills, and class structure while building confidence through age-appropriate instruction and activities."}
            imagePosition="left"
          />
          <ClassCard
            imageSrc={"/images/classes/class_4.png"}
            imageAlt={"test"}
            className={"Beginner / Level 1"}
            slug={"beginner-level-1"}
            price={59}
            duration={55}
            description={"Ideal for athletes beginning their tumbling journey. This class focuses on developing strength, flexibility, body control, and proper technique while working toward foundational skills such as bridges, cartwheels, and round-offs."}
            imagePosition="right"
          />
          <ClassCard
            imageSrc={"/images/classes/class_5.png"}
            imageAlt={"test"}
            className={"Advanced Beginner / Level 1.5"}
            slug={"adv-beginner-level-1-5"}
            price={59}
            duration={55}
            description={"For athletes who have mastered basic Level 1 skills and are ready for the next step. Students will continue building strength and technique while progressing to skills such as backbend kickovers, front limbers, and other introductory intermediate tumbling elements."}
            imagePosition="left"
          />
          <ClassCard
            imageSrc={"/images/classes/class_6.png"}
            imageAlt={"test"}
            className={"Intermediate / Level 2"}
            slug={"intermediate-level-2"}
            price={64}
            duration={55}
            description={"Designed for athletes ready to advance their tumbling abilities. This class focuses on mastering front walkovers, back walkovers, front handsprings, and back handsprings while emphasizing proper technique, power, and consistency."}
            imagePosition="right"
          />
          <ClassCard
            imageSrc={"/images/classes/class_7.png"}
            imageAlt={"test"}
            className={"Advanced / Level 3"}
            slug={"advanced-level-3"}
            price={64}
            duration={55}
            description={"For athletes who have confidently mastered front and back walkovers and are ready to progress into advanced tumbling. Instruction focuses on back handspring series, standing back handsprings, and the development of back tuck skills."}
            imagePosition="left"
          />
          <ClassCard
            imageSrc={"/images/classes/class_8.png"}
            imageAlt={"test"}
            className={"Elite / Level 4"}
            slug={"elite-level-4"}
            price={64}
            duration={60}
            description={"Our highest-level tumbling class for advanced athletes who have mastered round-off back handsprings and other foundational advanced skills. Athletes will work on high-level tumbling progressions including round-off back handspring tucks, layouts, full twists, standing tucks, and other elite tumbling elements, with a strong emphasis on technique, power, and execution."}
            imagePosition="right"
          />
        </div>
      </main>
    </div>
  );
}