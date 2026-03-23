export interface VocabWord {
  word: string;
  phonetic: string;
  meaning: string;
  example: string;
  exampleVi: string;
  wordFamily: string[];
}

export interface VocabSet {
  id: string;
  group: string;
  title: string;
  words: VocabWord[];
}

export const VOCAB_SETS: VocabSet[] = [
  {
    id: "1",
    group: "APTIS GENERAL",
    title: "Test 1 – Animals & Nature",
    words: [
      { word: "habitat", phonetic: "/ˈhæb.ɪ.tæt/", meaning: "môi trường sống", example: "The forest is a natural habitat for many species.", exampleVi: "Rừng là môi trường sống tự nhiên của nhiều loài.", wordFamily: ["habitation (n)", "habitable (adj)", "inhabit (v)"] },
      { word: "species", phonetic: "/ˈspiː.ʃiːz/", meaning: "loài", example: "There are thousands of species of birds worldwide.", exampleVi: "Có hàng nghìn loài chim trên thế giới.", wordFamily: ["specific (adj)", "specify (v)", "specimen (n)"] },
      { word: "wildlife", phonetic: "/ˈwaɪld.laɪf/", meaning: "động vật hoang dã", example: "We need to protect wildlife from extinction.", exampleVi: "Chúng ta cần bảo vệ động vật hoang dã khỏi tuyệt chủng.", wordFamily: ["wild (adj)", "wilderness (n)"] },
      { word: "endangered", phonetic: "/ɪnˈdeɪn.dʒəd/", meaning: "có nguy cơ tuyệt chủng", example: "The panda is an endangered animal.", exampleVi: "Gấu trúc là động vật có nguy cơ tuyệt chủng.", wordFamily: ["endanger (v)", "danger (n)", "dangerous (adj)"] },
      { word: "ecosystem", phonetic: "/ˈiː.koʊˌsɪs.təm/", meaning: "hệ sinh thái", example: "Coral reefs are important ecosystems.", exampleVi: "Rạn san hô là những hệ sinh thái quan trọng.", wordFamily: ["ecology (n)", "ecological (adj)", "ecologist (n)"] },
      { word: "predator", phonetic: "/ˈpred.ə.tər/", meaning: "động vật ăn thịt", example: "Lions are apex predators in the savanna.", exampleVi: "Sư tử là động vật ăn thịt đỉnh chuỗi thức ăn ở đồng cỏ.", wordFamily: ["predatory (adj)", "prey (n)"] },
      { word: "migrate", phonetic: "/maɪˈɡreɪt/", meaning: "di cư", example: "Many birds migrate south for the winter.", exampleVi: "Nhiều loài chim di cư về phương nam vào mùa đông.", wordFamily: ["migration (n)", "migratory (adj)", "migrant (n)"] },
      { word: "conservation", phonetic: "/ˌkɒn.səˈveɪ.ʃən/", meaning: "bảo tồn", example: "Conservation efforts have helped save many species.", exampleVi: "Nỗ lực bảo tồn đã giúp cứu nhiều loài.", wordFamily: ["conserve (v)", "conservative (adj)", "conservationist (n)"] },
      { word: "vegetation", phonetic: "/ˌvedʒ.ɪˈteɪ.ʃən/", meaning: "thảm thực vật", example: "The area is covered with dense vegetation.", exampleVi: "Khu vực này được phủ bởi thảm thực vật dày đặc.", wordFamily: ["vegetate (v)", "vegetable (n)"] },
      { word: "biodiversity", phonetic: "/ˌbaɪ.oʊ.daɪˈvɜː.sə.ti/", meaning: "đa dạng sinh học", example: "Rainforests have the highest biodiversity on Earth.", exampleVi: "Rừng mưa có đa dạng sinh học cao nhất trên Trái Đất.", wordFamily: ["biology (n)", "diverse (adj)", "diversity (n)"] },
    ],
  },
  {
    id: "2",
    group: "APTIS GENERAL",
    title: "Test 2 – Travel & Tourism",
    words: [
      { word: "itinerary", phonetic: "/aɪˈtɪn.ə.rer.i/", meaning: "lịch trình", example: "We planned a detailed itinerary for our trip.", exampleVi: "Chúng tôi đã lên lịch trình chi tiết cho chuyến đi.", wordFamily: ["itinerate (v)"] },
      { word: "accommodation", phonetic: "/əˌkɒm.əˈdeɪ.ʃən/", meaning: "chỗ ở", example: "We booked accommodation near the beach.", exampleVi: "Chúng tôi đã đặt chỗ ở gần bãi biển.", wordFamily: ["accommodate (v)", "accommodating (adj)"] },
      { word: "destination", phonetic: "/ˌdes.tɪˈneɪ.ʃən/", meaning: "điểm đến", example: "Paris is a popular tourist destination.", exampleVi: "Paris là điểm đến du lịch phổ biến.", wordFamily: ["destine (v)", "destiny (n)"] },
      { word: "excursion", phonetic: "/ɪkˈskɜː.ʒən/", meaning: "chuyến tham quan", example: "We went on a boat excursion around the island.", exampleVi: "Chúng tôi đi chuyến tham quan bằng thuyền quanh đảo.", wordFamily: ["excursionist (n)"] },
      { word: "souvenir", phonetic: "/ˌsuː.vəˈnɪr/", meaning: "quà lưu niệm", example: "I bought a souvenir for my family.", exampleVi: "Tôi đã mua quà lưu niệm cho gia đình.", wordFamily: [] },
      { word: "sightseeing", phonetic: "/ˈsaɪtˌsiː.ɪŋ/", meaning: "tham quan", example: "We spent the day sightseeing in London.", exampleVi: "Chúng tôi dành cả ngày tham quan London.", wordFamily: ["sightsee (v)", "sight (n)"] },
      { word: "hospitality", phonetic: "/ˌhɒs.pɪˈtæl.ə.ti/", meaning: "lòng hiếu khách", example: "The local hospitality made us feel welcome.", exampleVi: "Lòng hiếu khách của người địa phương khiến chúng tôi cảm thấy được chào đón.", wordFamily: ["hospitable (adj)", "hospital (n)", "host (n/v)"] },
      { word: "luggage", phonetic: "/ˈlʌɡ.ɪdʒ/", meaning: "hành lý", example: "Please keep your luggage with you at all times.", exampleVi: "Vui lòng giữ hành lý bên mình mọi lúc.", wordFamily: ["lug (v)"] },
    ],
  },
  {
    id: "3",
    group: "APTIS GENERAL",
    title: "Test 3 – Health & Lifestyle",
    words: [
      { word: "nutrition", phonetic: "/njuːˈtrɪʃ.ən/", meaning: "dinh dưỡng", example: "Good nutrition is essential for health.", exampleVi: "Dinh dưỡng tốt là cần thiết cho sức khỏe.", wordFamily: ["nutritious (adj)", "nutrient (n)", "nutritional (adj)"] },
      { word: "symptom", phonetic: "/ˈsɪmp.təm/", meaning: "triệu chứng", example: "Fever is a common symptom of infection.", exampleVi: "Sốt là triệu chứng phổ biến của nhiễm trùng.", wordFamily: ["symptomatic (adj)"] },
      { word: "exercise", phonetic: "/ˈek.sə.saɪz/", meaning: "tập thể dục", example: "Regular exercise improves mental health.", exampleVi: "Tập thể dục thường xuyên cải thiện sức khỏe tinh thần.", wordFamily: ["exerciser (n)"] },
      { word: "diagnosis", phonetic: "/ˌdaɪ.əɡˈnoʊ.sɪs/", meaning: "chẩn đoán", example: "The doctor made a quick diagnosis.", exampleVi: "Bác sĩ đưa ra chẩn đoán nhanh chóng.", wordFamily: ["diagnose (v)", "diagnostic (adj)"] },
      { word: "prevention", phonetic: "/prɪˈven.ʃən/", meaning: "phòng ngừa", example: "Prevention is better than cure.", exampleVi: "Phòng bệnh hơn chữa bệnh.", wordFamily: ["prevent (v)", "preventive (adj)", "preventable (adj)"] },
      { word: "obesity", phonetic: "/oʊˈbiː.sə.ti/", meaning: "béo phì", example: "Obesity is a growing health concern.", exampleVi: "Béo phì là mối lo ngại sức khỏe ngày càng tăng.", wordFamily: ["obese (adj)"] },
    ],
  },
  {
    id: "4",
    group: "APTIS GENERAL",
    title: "Test 4 – Education & Learning",
    words: [
      { word: "curriculum", phonetic: "/kəˈrɪk.jə.ləm/", meaning: "chương trình học", example: "The school updated its curriculum.", exampleVi: "Trường đã cập nhật chương trình học.", wordFamily: ["curricular (adj)", "extracurricular (adj)"] },
      { word: "assessment", phonetic: "/əˈses.mənt/", meaning: "đánh giá", example: "The assessment tests students' knowledge.", exampleVi: "Bài đánh giá kiểm tra kiến thức học sinh.", wordFamily: ["assess (v)", "assessor (n)"] },
      { word: "scholarship", phonetic: "/ˈskɒl.ə.ʃɪp/", meaning: "học bổng", example: "She won a scholarship to study abroad.", exampleVi: "Cô ấy đạt học bổng du học.", wordFamily: ["scholar (n)", "scholarly (adj)"] },
      { word: "lecture", phonetic: "/ˈlek.tʃər/", meaning: "bài giảng", example: "The professor gave an interesting lecture.", exampleVi: "Giáo sư đã giảng một bài rất hay.", wordFamily: ["lecturer (n)", "lectureship (n)"] },
      { word: "discipline", phonetic: "/ˈdɪs.ə.plɪn/", meaning: "kỷ luật / môn học", example: "History is an important academic discipline.", exampleVi: "Lịch sử là một môn học quan trọng.", wordFamily: ["disciplinary (adj)", "disciplined (adj)"] },
    ],
  },
  {
    id: "5",
    group: "APTIS GENERAL",
    title: "Test 5 – Technology & Media",
    words: [
      { word: "innovation", phonetic: "/ˌɪn.əˈveɪ.ʃən/", meaning: "đổi mới, sáng tạo", example: "Technology drives innovation in every field.", exampleVi: "Công nghệ thúc đẩy đổi mới trong mọi lĩnh vực.", wordFamily: ["innovate (v)", "innovative (adj)", "innovator (n)"] },
      { word: "broadcast", phonetic: "/ˈbrɔːd.kæst/", meaning: "phát sóng", example: "The event was broadcast live on TV.", exampleVi: "Sự kiện được phát sóng trực tiếp trên TV.", wordFamily: ["broadcaster (n)", "broadcasting (n)"] },
      { word: "artificial", phonetic: "/ˌɑː.tɪˈfɪʃ.əl/", meaning: "nhân tạo", example: "Artificial intelligence is changing the world.", exampleVi: "Trí tuệ nhân tạo đang thay đổi thế giới.", wordFamily: ["artificially (adv)", "artifact (n)"] },
      { word: "gadget", phonetic: "/ˈɡædʒ.ɪt/", meaning: "thiết bị, đồ công nghệ", example: "He loves buying the latest gadgets.", exampleVi: "Anh ấy thích mua những thiết bị công nghệ mới nhất.", wordFamily: ["gadgetry (n)"] },
      { word: "cybersecurity", phonetic: "/ˌsaɪ.bə.sɪˈkjʊr.ə.ti/", meaning: "an ninh mạng", example: "Cybersecurity is a top priority for businesses.", exampleVi: "An ninh mạng là ưu tiên hàng đầu cho doanh nghiệp.", wordFamily: ["cyber (adj)", "security (n)", "secure (adj/v)"] },
    ],
  },
  {
    id: "6",
    group: "APTIS GENERAL",
    title: "Test 6 – Work & Career",
    words: [
      { word: "promotion", phonetic: "/prəˈmoʊ.ʃən/", meaning: "thăng chức", example: "She got a promotion after two years.", exampleVi: "Cô ấy được thăng chức sau hai năm.", wordFamily: ["promote (v)", "promoter (n)", "promotional (adj)"] },
      { word: "colleague", phonetic: "/ˈkɒl.iːɡ/", meaning: "đồng nghiệp", example: "I get along well with my colleagues.", exampleVi: "Tôi hòa đồng tốt với đồng nghiệp.", wordFamily: [] },
      { word: "recruitment", phonetic: "/rɪˈkruːt.mənt/", meaning: "tuyển dụng", example: "The company is in charge of recruitment.", exampleVi: "Công ty phụ trách tuyển dụng.", wordFamily: ["recruit (v/n)", "recruiter (n)"] },
      { word: "qualification", phonetic: "/ˌkwɒl.ɪ.fɪˈkeɪ.ʃən/", meaning: "bằng cấp, trình độ", example: "What qualifications do you need for this job?", exampleVi: "Bạn cần bằng cấp gì cho công việc này?", wordFamily: ["qualify (v)", "qualified (adj)"] },
      { word: "deadline", phonetic: "/ˈded.laɪn/", meaning: "hạn chót", example: "The deadline for the project is Friday.", exampleVi: "Hạn chót của dự án là thứ Sáu.", wordFamily: [] },
    ],
  },
  {
    id: "7",
    group: "APTIS ADVANCED",
    title: "Test 7 – Environment & Society",
    words: [
      { word: "sustainability", phonetic: "/səˌsteɪ.nəˈbɪl.ə.ti/", meaning: "tính bền vững", example: "Sustainability is key to our future.", exampleVi: "Tính bền vững là chìa khóa cho tương lai.", wordFamily: ["sustain (v)", "sustainable (adj)", "sustainably (adv)"] },
      { word: "pollution", phonetic: "/pəˈluː.ʃən/", meaning: "ô nhiễm", example: "Air pollution affects millions of people.", exampleVi: "Ô nhiễm không khí ảnh hưởng hàng triệu người.", wordFamily: ["pollute (v)", "pollutant (n)", "polluted (adj)"] },
      { word: "inequality", phonetic: "/ˌɪn.ɪˈkwɒl.ə.ti/", meaning: "bất bình đẳng", example: "Income inequality is a major social issue.", exampleVi: "Bất bình đẳng thu nhập là vấn đề xã hội lớn.", wordFamily: ["equal (adj)", "equality (n)", "unequal (adj)"] },
      { word: "renewable", phonetic: "/rɪˈnjuː.ə.bəl/", meaning: "tái tạo được", example: "Solar energy is a renewable resource.", exampleVi: "Năng lượng mặt trời là tài nguyên tái tạo.", wordFamily: ["renew (v)", "renewal (n)"] },
    ],
  },
  {
    id: "8",
    group: "APTIS ADVANCED",
    title: "Test 8 – Culture & Arts",
    words: [
      { word: "heritage", phonetic: "/ˈher.ɪ.tɪdʒ/", meaning: "di sản", example: "The city is proud of its cultural heritage.", exampleVi: "Thành phố tự hào về di sản văn hóa.", wordFamily: ["inherit (v)", "inheritance (n)", "heir (n)"] },
      { word: "contemporary", phonetic: "/kənˈtem.pə.rer.i/", meaning: "đương đại", example: "She enjoys contemporary art exhibitions.", exampleVi: "Cô ấy thích triển lãm nghệ thuật đương đại.", wordFamily: ["contemporaneous (adj)"] },
      { word: "exhibition", phonetic: "/ˌek.sɪˈbɪʃ.ən/", meaning: "triển lãm", example: "The museum held an exhibition on ancient Egypt.", exampleVi: "Bảo tàng tổ chức triển lãm về Ai Cập cổ đại.", wordFamily: ["exhibit (v/n)", "exhibitor (n)"] },
      { word: "masterpiece", phonetic: "/ˈmɑː.stə.piːs/", meaning: "kiệt tác", example: "The painting is considered a masterpiece.", exampleVi: "Bức tranh được coi là kiệt tác.", wordFamily: ["master (n/v)", "mastery (n)"] },
    ],
  },
  {
    id: "9",
    group: "APTIS ADVANCED",
    title: "Test 9 – Science & Innovation",
    words: [
      { word: "hypothesis", phonetic: "/haɪˈpɒθ.ə.sɪs/", meaning: "giả thuyết", example: "The scientist tested her hypothesis.", exampleVi: "Nhà khoa học kiểm chứng giả thuyết.", wordFamily: ["hypothesize (v)", "hypothetical (adj)"] },
      { word: "experiment", phonetic: "/ɪkˈsper.ɪ.mənt/", meaning: "thí nghiệm", example: "The experiment produced unexpected results.", exampleVi: "Thí nghiệm cho ra kết quả bất ngờ.", wordFamily: ["experimental (adj)", "experimentation (n)"] },
      { word: "breakthrough", phonetic: "/ˈbreɪk.θruː/", meaning: "bước đột phá", example: "The discovery was a major breakthrough.", exampleVi: "Phát hiện này là bước đột phá lớn.", wordFamily: ["break through (phr v)"] },
      { word: "phenomenon", phonetic: "/fɪˈnɒm.ɪ.nən/", meaning: "hiện tượng", example: "Climate change is a global phenomenon.", exampleVi: "Biến đổi khí hậu là hiện tượng toàn cầu.", wordFamily: ["phenomenal (adj)", "phenomena (n, pl)"] },
    ],
  },
];
