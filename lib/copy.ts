/** Shared, presentation-only English/Vietnamese product copy. */
export const supportedLocales = ['en', 'vi'] as const;
export type Locale = (typeof supportedLocales)[number];

export const localeMetadata: Record<
  Locale,
  { label: string; documentLang: string }
> = {
  en: { label: 'English', documentLang: 'en' },
  vi: { label: 'Tiếng Việt', documentLang: 'vi' },
};

const englishCopy = {
  app: {
    name: 'Nourishwell',
    tagline: 'Private nutrition and movement support',
    language: 'Language',
    changeLanguage: 'Change language',
  },
  nav: {
    today: 'Today',
    capture: 'Capture',
    measurements: 'Measurements',
    workouts: 'Workouts',
    settings: 'Settings',
    openNavigation: 'Open navigation',
    closeNavigation: 'Close navigation',
  },
  common: {
    back: 'Back',
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    save: 'Save',
    saving: 'Saving…',
    edit: 'Edit',
    delete: 'Delete',
    retry: 'Try again',
    loading: 'Loading…',
    required: 'Required',
    optional: 'Optional',
    private: 'Private',
  },
  today: {
    confirmedOnly: 'Confirmed meal records only',
    title: 'Today, with clear evidence.',
    logMeal: 'Log a meal',
    calories: 'Calories',
    protein: 'Protein',
    fiber: 'Fiber',
    sodium: 'Sodium',
    remaining: 'remaining',
    noTarget: 'No daily target set',
    mealLog: 'Today’s meal log',
    confirmedEntries: 'Your confirmed entries',
    loadingRecords: 'Loading your private records…',
    evidenceTitle: 'Evidence stays visible.',
    evidenceDescription:
      'Each saved meal keeps its ingredients, serving assumption, estimate source, and confidence. Nothing is auto-saved.',
    guidanceTitle: 'Health guidance comes next',
    guidanceDescription:
      'Personal targets and clinician-approved rules will be connected after onboarding. Today’s starter targets are not medical advice.',
    emptyTitle: 'No meals confirmed today',
    emptyDescription:
      'Start with a short typed description. You can edit every estimate before saving.',
    captureMeal: 'Capture a meal',
  },
  mealCapture: {
    eyebrow: 'Capture · review required',
    title: 'What did you have?',
    description:
      'Describe a meal, scan a barcode, or search a food composition database.',
    text: 'Text',
    barcode: 'Barcode',
    vietnamData: 'Vietnam data',
    usda: 'USDA',
    mealPlaceholder: 'For example: phở bò with extra herbs, no chili oil',
    barcodePlaceholder: 'Enter an 8–14 digit barcode',
    vietnamDishPlaceholder: 'For example: cơm gà',
    vietnamIngredientPlaceholder: 'For example: thịt gà',
    usdaPlaceholder: 'For example: chicken breast, broccoli',
    analyse: 'Analyse and review',
    analysing: 'Preparing review…',
    reviewTitle: 'Review before saving',
    emptyReviewTitle: 'Nothing is saved automatically',
    emptyReviewDescription:
      'Analyse a meal, inspect the ingredients and values, then confirm it yourself.',
    confidence: 'confidence',
    confirmMeal: 'Confirm meal',
    discardReview: 'Discard review',
    servingAssumption: 'Serving assumption',
    ingredients: 'Ingredients',
    source: 'Source',
    estimate: 'Estimate',
    manualEntry: 'Manual entry',
    reviewRequired: 'Review required before saving.',
    vietnamDish: 'Dish / Món ăn',
    vietnamIngredient: 'Ingredient / Thực phẩm',
    vietnamSearchLabel: 'Vietnam nutrition catalog search',
    usdaSearchLabel: 'USDA food search',
    typedProviderNote:
      'Typed meals use transparent starter rules. Always review the values.',
    barcodeProviderNote:
      'Barcode lookup uses Open Food Facts product data. The product label and your confirmation take priority.',
    vietnamProviderNote:
      'Vietnam nutrition catalog values are database-derived. Review the match and your serving before saving.',
    usdaProviderNote:
      'USDA FoodData Central uses a 100 g database basis and requires a private API key. Review the food and serving before saving.',
    reviewPlaceholder: 'Your meal will appear here',
    detectedIngredients: 'Detected ingredients',
    serving: 'Serving',
    sourceAndReview: 'Source and review note',
    conditionChecks: 'Condition-specific checks',
    conditionChecksDescription:
      'Versioned tracking rules—not diagnoses or medical advice. They do not alter the nutrient values above.',
    discard: 'Discard',
    confirmAndSave: 'Confirm & save',
  },
  measurements: {
    eyebrow: 'Measurements',
    title: 'Track a measurement',
    description:
      'Enter a value you measured yourself. Review it before saving.',
    add: 'Add measurement',
    metric: 'Measurement type',
    customLabel: 'Lab test name',
    customLabelPlaceholder: 'For example: Vitamin D',
    value: 'Value',
    secondaryValue: 'Second value',
    unit: 'Unit',
    unitPlaceholder: 'For example: ng/mL',
    measuredAt: 'Measured at',
    saveMeasurement: 'Save measurement',
    emptyTitle: 'No measurements yet',
    emptyDescription: 'Your confirmed measurements will appear here.',
    metrics: {
      weight: 'Weight',
      bloodPressure: 'Blood pressure',
      bloodGlucose: 'Blood glucose',
      totalCholesterol: 'Total cholesterol',
      uricAcid: 'Uric acid',
      customLab: 'Custom lab result',
    },
  },
  workouts: {
    eyebrow: 'Movement safety',
    title: 'Workout readiness',
    description:
      'Complete this screen before the app can generate a workout plan. It does not replace medical advice.',
    screeningTitle: 'Tell us what applies today',
    screeningDescription:
      'Select every statement that applies. Any selection pauses new plan generation for professional review.',
    chestPain: 'Chest pain, pressure, or tightness with activity',
    faintingOrDizziness: 'Fainting, new severe dizziness, or confusion',
    severeShortnessOfBreath: 'Unusual or severe shortness of breath',
    irregularHeartbeat: 'A fast or irregular heartbeat with activity',
    clinicianRestriction: 'A clinician has told me to avoid or restrict exercise',
    exerciseGlucoseRisk:
      'I use insulin or a medicine that can lower glucose and do not have an exercise plan from my care team',
    confirm: 'Confirm workout readiness',
    clearedTitle: 'Readiness confirmed',
    clearedDescription:
      'No gate flags were reported. A future plan will still use your equipment, recovery, and clinician restrictions.',
    pausedTitle: 'Workout plan paused',
    pausedDescription:
      'Do not start a new program from this app until the reported concern is reviewed by an appropriate clinician. Seek urgent care for severe or emergency symptoms.',
    incompleteTitle: 'Readiness required',
    incompleteDescription:
      'A workout plan cannot be generated until you complete this safety screen.',
    catalogTitle: 'Starter exercise library',
    catalogDescription:
      'These movements are a transparent starter catalog, not a workout prescription. A future plan will choose only compatible options.',
    technique: 'Technique',
    regression: 'Make it easier',
    progression: 'Progress later',
    equipment: 'Equipment',
    planTitle: 'Your starter week',
    previewPlan: 'Generate plan preview',
    confirmPlan: 'Confirm this plan',
    planPreviewNote:
      'Review this conservative plan before saving. It is intentionally not adapted to symptoms, recovery, or equipment changes yet.',
    confirmedPlanNote:
      'Confirmed plan. Log completion and recovery in the upcoming workout-log flow.',
    minutes: 'minutes',
    effort: 'Effort',
  },
  settings: {
    eyebrow: 'Settings',
    title: 'Personal targets',
    description:
      'Use targets you set for yourself. Clinician-defined targets always take priority.',
    calories: 'Calories',
    protein: 'Protein',
    fiber: 'Fiber',
    sodium: 'Sodium',
    saveTargets: 'Save personal targets',
    healthFocuses: 'Health focuses',
    healthFocusDescription: 'Optional tracking preferences, not diagnoses.',
    saveHealthFocuses: 'Save health focuses',
    dataPrivacy: 'Privacy and data',
    exportData: 'Export my data',
    deleteData: 'Delete my data',
    targetsDescription:
      'These targets guide the Today dashboard only; they are not medical advice.',
    targetSuffix: 'target',
    bloodPressure: 'Blood pressure',
    bloodPressureDescription: 'Prioritize sodium-related review checks.',
    cholesterol: 'Cholesterol',
    cholesterolDescription: 'Prioritize fiber-pattern review checks.',
    bloodGlucose: 'Blood glucose',
    bloodGlucoseDescription:
      'Saved now; exercise and carbohydrate safety rules come later.',
    uricAcid: 'Uric acid / gout',
    uricAcidDescription: 'Saved now; purine-risk rules come later.',
    addFocus: 'Add',
    removeFocus: 'Remove',
    focusSuffix: 'health focus',
    sensitiveDataNotice:
      'Do not enter medication, symptoms, or clinician notes here yet. Those need the upcoming encrypted health-profile flow.',
  },
  safety: {
    notMedicalAdvice:
      'This information is for general wellness support and is not medical advice.',
    reviewBeforeSaving:
      'Review values, serving assumptions, and sources before saving.',
    noAutomaticSaving: 'Nothing is saved automatically.',
    seekUrgentCare:
      'Seek urgent medical care for severe symptoms or an emergency.',
    stopTraining:
      'Stop activity if you have chest pain, severe shortness of breath, fainting, sudden dizziness, or concerning new symptoms.',
    clinicianPriority:
      'Follow your clinician’s advice. Clinician-defined targets and restrictions take priority.',
    noDiagnosis:
      'Tracking preferences and meal findings are not diagnoses or treatment recommendations.',
    sensitiveData:
      'Do not enter medication details, symptoms, or clinician notes until the encrypted health-profile flow is available.',
  },
} as const;

type StringLeafShape<T> = T extends string
  ? string
  : { [Key in keyof T]: StringLeafShape<T[Key]> };

/** The stable key structure every supported locale must provide. */
export type ProductCopy = StringLeafShape<typeof englishCopy>;

const vietnameseCopy: ProductCopy = {
  app: {
    name: 'Nourishwell',
    tagline: 'Hỗ trợ riêng tư về dinh dưỡng và vận động',
    language: 'Ngôn ngữ',
    changeLanguage: 'Đổi ngôn ngữ',
  },
  nav: {
    today: 'Hôm nay',
    capture: 'Ghi bữa ăn',
    measurements: 'Chỉ số',
    workouts: 'Tập luyện',
    settings: 'Cài đặt',
    openNavigation: 'Mở điều hướng',
    closeNavigation: 'Đóng điều hướng',
  },
  common: {
    back: 'Quay lại',
    cancel: 'Hủy',
    close: 'Đóng',
    confirm: 'Xác nhận',
    save: 'Lưu',
    saving: 'Đang lưu…',
    edit: 'Chỉnh sửa',
    delete: 'Xóa',
    retry: 'Thử lại',
    loading: 'Đang tải…',
    required: 'Bắt buộc',
    optional: 'Tùy chọn',
    private: 'Riêng tư',
  },
  today: {
    confirmedOnly: 'Chỉ các bữa ăn đã xác nhận',
    title: 'Hôm nay, với thông tin rõ ràng.',
    logMeal: 'Ghi bữa ăn',
    calories: 'Năng lượng',
    protein: 'Chất đạm',
    fiber: 'Chất xơ',
    sodium: 'Natri',
    remaining: 'còn lại',
    noTarget: 'Chưa đặt mục tiêu hằng ngày',
    mealLog: 'Nhật ký bữa ăn hôm nay',
    confirmedEntries: 'Các mục đã xác nhận',
    loadingRecords: 'Đang tải dữ liệu riêng tư của bạn…',
    evidenceTitle: 'Thông tin nguồn luôn hiển thị.',
    evidenceDescription:
      'Mỗi bữa ăn đã lưu giữ lại nguyên liệu, khẩu phần giả định, nguồn ước tính và độ tin cậy. Không có gì được tự động lưu.',
    guidanceTitle: 'Hướng dẫn sức khỏe sẽ có tiếp theo',
    guidanceDescription:
      'Mục tiêu cá nhân và các quy tắc được bác sĩ chấp thuận sẽ được kết nối sau phần thiết lập ban đầu. Các mục tiêu mẫu hôm nay không phải lời khuyên y tế.',
    emptyTitle: 'Hôm nay chưa có bữa ăn nào được xác nhận',
    emptyDescription:
      'Bắt đầu bằng một mô tả ngắn. Bạn có thể chỉnh sửa mọi ước tính trước khi lưu.',
    captureMeal: 'Ghi bữa ăn',
  },
  mealCapture: {
    eyebrow: 'Ghi nhận · cần xem lại',
    title: 'Bạn đã ăn gì?',
    description:
      'Mô tả bữa ăn, quét mã vạch hoặc tìm trong cơ sở dữ liệu thành phần thực phẩm.',
    text: 'Nhập món ăn',
    barcode: 'Mã vạch',
    vietnamData: 'Dữ liệu Việt Nam',
    usda: 'USDA',
    mealPlaceholder: 'Ví dụ: phở bò thêm rau thơm, không dầu ớt',
    barcodePlaceholder: 'Nhập mã vạch gồm 8–14 chữ số',
    vietnamDishPlaceholder: 'Ví dụ: cơm gà',
    vietnamIngredientPlaceholder: 'Ví dụ: thịt gà',
    usdaPlaceholder: 'Ví dụ: ức gà, bông cải xanh',
    analyse: 'Phân tích và xem lại',
    analysing: 'Đang chuẩn bị bản xem lại…',
    reviewTitle: 'Xem lại trước khi lưu',
    emptyReviewTitle: 'Không có gì được tự động lưu',
    emptyReviewDescription:
      'Phân tích bữa ăn, kiểm tra nguyên liệu và các giá trị, rồi tự bạn xác nhận.',
    confidence: 'độ tin cậy',
    confirmMeal: 'Xác nhận bữa ăn',
    discardReview: 'Bỏ bản xem lại',
    servingAssumption: 'Khẩu phần giả định',
    ingredients: 'Nguyên liệu',
    source: 'Nguồn',
    estimate: 'Ước tính',
    manualEntry: 'Nhập thủ công',
    reviewRequired: 'Cần xem lại trước khi lưu.',
    vietnamDish: 'Món ăn / Dish',
    vietnamIngredient: 'Thực phẩm / Ingredient',
    vietnamSearchLabel: 'Tìm kiếm trong cơ sở dữ liệu dinh dưỡng Việt Nam',
    usdaSearchLabel: 'Tìm kiếm thực phẩm USDA',
    typedProviderNote:
      'Các bữa ăn nhập chữ dùng quy tắc khởi đầu minh bạch. Luôn kiểm tra lại các giá trị.',
    barcodeProviderNote:
      'Tra mã vạch dùng dữ liệu sản phẩm Open Food Facts. Nhãn sản phẩm và xác nhận của bạn được ưu tiên.',
    vietnamProviderNote:
      'Giá trị từ cơ sở dữ liệu dinh dưỡng Việt Nam. Hãy kiểm tra món khớp và khẩu phần trước khi lưu.',
    usdaProviderNote:
      'USDA FoodData Central dùng cơ sở dữ liệu theo 100 g và cần khóa API riêng tư. Hãy kiểm tra thực phẩm và khẩu phần trước khi lưu.',
    reviewPlaceholder: 'Bữa ăn của bạn sẽ xuất hiện ở đây',
    detectedIngredients: 'Nguyên liệu được nhận diện',
    serving: 'Khẩu phần',
    sourceAndReview: 'Nguồn và ghi chú xem lại',
    conditionChecks: 'Kiểm tra theo tình trạng',
    conditionChecksDescription:
      'Các quy tắc theo dõi có phiên bản — không phải chẩn đoán hay lời khuyên y tế. Chúng không thay đổi giá trị dinh dưỡng ở trên.',
    discard: 'Bỏ',
    confirmAndSave: 'Xác nhận và lưu',
  },
  measurements: {
    eyebrow: 'Chỉ số',
    title: 'Theo dõi chỉ số',
    description: 'Nhập giá trị bạn tự đo. Hãy xem lại trước khi lưu.',
    add: 'Thêm chỉ số',
    metric: 'Loại chỉ số',
    customLabel: 'Tên xét nghiệm',
    customLabelPlaceholder: 'Ví dụ: Vitamin D',
    value: 'Giá trị',
    secondaryValue: 'Giá trị thứ hai',
    unit: 'Đơn vị',
    unitPlaceholder: 'Ví dụ: ng/mL',
    measuredAt: 'Thời điểm đo',
    saveMeasurement: 'Lưu chỉ số',
    emptyTitle: 'Chưa có chỉ số nào',
    emptyDescription: 'Các chỉ số bạn xác nhận sẽ xuất hiện ở đây.',
    metrics: {
      weight: 'Cân nặng',
      bloodPressure: 'Huyết áp',
      bloodGlucose: 'Đường huyết',
      totalCholesterol: 'Cholesterol toàn phần',
      uricAcid: 'Axit uric',
      customLab: 'Kết quả xét nghiệm khác',
    },
  },
  workouts: {
    eyebrow: 'An toàn vận động',
    title: 'Sẵn sàng tập luyện',
    description:
      'Hoàn thành phần này trước khi ứng dụng có thể tạo kế hoạch tập. Phần này không thay thế lời khuyên y tế.',
    screeningTitle: 'Cho biết điều nào đúng với bạn hôm nay',
    screeningDescription:
      'Chọn tất cả điều phù hợp. Bất kỳ lựa chọn nào cũng sẽ tạm dừng tạo kế hoạch mới để cần đánh giá chuyên môn.',
    chestPain: 'Đau, tức hoặc nặng ngực khi vận động',
    faintingOrDizziness: 'Ngất, chóng mặt nặng mới xuất hiện hoặc lú lẫn',
    severeShortnessOfBreath: 'Khó thở bất thường hoặc nghiêm trọng',
    irregularHeartbeat: 'Tim đập nhanh hoặc không đều khi vận động',
    clinicianRestriction: 'Bác sĩ đã yêu cầu tôi tránh hoặc hạn chế tập luyện',
    exerciseGlucoseRisk:
      'Tôi dùng insulin hoặc thuốc có thể làm hạ đường huyết và chưa có kế hoạch tập từ đội ngũ chăm sóc',
    confirm: 'Xác nhận sẵn sàng tập luyện',
    clearedTitle: 'Đã xác nhận sẵn sàng',
    clearedDescription:
      'Bạn không báo cáo cờ an toàn nào. Kế hoạch trong tương lai vẫn sẽ dùng thiết bị, hồi phục và hạn chế của bác sĩ.',
    pausedTitle: 'Đã tạm dừng kế hoạch tập',
    pausedDescription:
      'Không bắt đầu chương trình mới từ ứng dụng này cho đến khi vấn đề được báo cáo được chuyên gia phù hợp xem xét. Hãy tìm trợ giúp khẩn cấp khi có triệu chứng nặng hoặc cấp cứu.',
    incompleteTitle: 'Cần hoàn thành sàng lọc',
    incompleteDescription:
      'Không thể tạo kế hoạch tập cho đến khi bạn hoàn thành màn hình an toàn này.',
    catalogTitle: 'Thư viện bài tập khởi đầu',
    catalogDescription:
      'Các động tác này là danh mục khởi đầu minh bạch, không phải đơn tập. Kế hoạch trong tương lai chỉ chọn các lựa chọn phù hợp.',
    technique: 'Kỹ thuật',
    regression: 'Giảm độ khó',
    progression: 'Tiến triển sau',
    equipment: 'Dụng cụ',
    planTitle: 'Tuần khởi đầu của bạn',
    previewPlan: 'Tạo bản xem trước kế hoạch',
    confirmPlan: 'Xác nhận kế hoạch này',
    planPreviewNote:
      'Hãy xem lại kế hoạch thận trọng này trước khi lưu. Hiện kế hoạch chưa điều chỉnh theo triệu chứng, hồi phục hoặc thay đổi thiết bị.',
    confirmedPlanNote:
      'Kế hoạch đã xác nhận. Hãy ghi nhận hoàn thành và hồi phục trong luồng nhật ký tập sắp tới.',
    minutes: 'phút',
    effort: 'Cường độ',
  },
  settings: {
    eyebrow: 'Cài đặt',
    title: 'Mục tiêu cá nhân',
    description:
      'Dùng các mục tiêu do bạn tự đặt. Mục tiêu do bác sĩ chỉ định luôn được ưu tiên.',
    calories: 'Năng lượng',
    protein: 'Chất đạm',
    fiber: 'Chất xơ',
    sodium: 'Natri',
    saveTargets: 'Lưu mục tiêu cá nhân',
    healthFocuses: 'Mối quan tâm sức khỏe',
    healthFocusDescription: 'Tùy chọn theo dõi, không phải chẩn đoán.',
    saveHealthFocuses: 'Lưu mối quan tâm sức khỏe',
    dataPrivacy: 'Quyền riêng tư và dữ liệu',
    exportData: 'Xuất dữ liệu của tôi',
    deleteData: 'Xóa dữ liệu của tôi',
    targetsDescription:
      'Các mục tiêu này chỉ dùng cho bảng Hôm nay; chúng không phải lời khuyên y tế.',
    targetSuffix: 'mục tiêu',
    bloodPressure: 'Huyết áp',
    bloodPressureDescription: 'Ưu tiên các kiểm tra liên quan đến natri.',
    cholesterol: 'Cholesterol',
    cholesterolDescription: 'Ưu tiên các kiểm tra theo xu hướng chất xơ.',
    bloodGlucose: 'Đường huyết',
    bloodGlucoseDescription:
      'Được lưu ngay; các quy tắc an toàn về tập luyện và carbohydrate sẽ có sau.',
    uricAcid: 'Axit uric / gout',
    uricAcidDescription:
      'Được lưu ngay; các quy tắc về nguy cơ purin sẽ có sau.',
    addFocus: 'Thêm',
    removeFocus: 'Bỏ',
    focusSuffix: 'mối quan tâm sức khỏe',
    sensitiveDataNotice:
      'Chưa nhập thông tin thuốc, triệu chứng hoặc ghi chú của bác sĩ tại đây. Các dữ liệu này cần luồng hồ sơ sức khỏe mã hóa sắp tới.',
  },
  safety: {
    notMedicalAdvice:
      'Thông tin này hỗ trợ sức khỏe tổng quát, không phải lời khuyên y tế.',
    reviewBeforeSaving:
      'Hãy kiểm tra các giá trị, khẩu phần giả định và nguồn trước khi lưu.',
    noAutomaticSaving: 'Không có gì được tự động lưu.',
    seekUrgentCare:
      'Hãy tìm hỗ trợ y tế khẩn cấp khi có triệu chứng nặng hoặc tình trạng cấp cứu.',
    stopTraining:
      'Dừng vận động nếu đau ngực, khó thở nhiều, ngất, chóng mặt đột ngột hoặc có triệu chứng mới đáng lo.',
    clinicianPriority:
      'Hãy làm theo hướng dẫn của bác sĩ. Mục tiêu và hạn chế do bác sĩ chỉ định luôn được ưu tiên.',
    noDiagnosis:
      'Các lựa chọn theo dõi và nhận xét về bữa ăn không phải chẩn đoán hay khuyến nghị điều trị.',
    sensitiveData:
      'Không nhập chi tiết thuốc, triệu chứng hoặc ghi chú của bác sĩ cho đến khi có hồ sơ sức khỏe được mã hóa.',
  },
};

export const copy: Record<Locale, ProductCopy> = {
  en: englishCopy,
  vi: vietnameseCopy,
};

export function isLocale(value: string | null | undefined): value is Locale {
  return (
    value !== undefined &&
    value !== null &&
    supportedLocales.includes(value as Locale)
  );
}

export function getCopy(locale: Locale | null | undefined): ProductCopy {
  return copy[locale && isLocale(locale) ? locale : 'en'];
}
