CREATE TABLE `exercise_catalog` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `category` text NOT NULL,
  `equipment` text NOT NULL,
  `muscle_groups` text NOT NULL,
  `contraindication_tags` text NOT NULL,
  `technique` text NOT NULL,
  `regression` text NOT NULL,
  `progression` text NOT NULL,
  `substitution_ids` text NOT NULL,
  `catalog_version` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_exercise_catalog_category` ON `exercise_catalog` (`category`);
--> statement-breakpoint
INSERT INTO `exercise_catalog` (`id`,`name`,`category`,`equipment`,`muscle_groups`,`contraindication_tags`,`technique`,`regression`,`progression`,`substitution_ids`,`catalog_version`,`created_at`,`updated_at`) VALUES
('cat-cow','{"en":"Cat-cow","vi":"Mèo-bò"}','mobility','["exercise mat"]','["spine","shoulders"]','["wrist_pain","knee_pain"]','{"en":"Move slowly through a comfortable spine range while breathing steadily.","vi":"Di chuyển chậm trong biên độ cột sống thoải mái và thở đều."}','{"en":"Perform standing spinal mobility with hands on thighs.","vi":"Thực hiện vận động cột sống đứng, hai tay đặt trên đùi."}','{"en":"Add a gentle pause at each end range.","vi":"Thêm một khoảng dừng nhẹ ở cuối mỗi biên độ."}','["treadmill-walk"]','starter-1',1788028698053,1788028698053),
('sit-to-stand','{"en":"Sit to stand","vi":"Đứng lên ngồi xuống"}','strength','["chair"]','["legs","glutes"]','["knee_pain","balance_risk"]','{"en":"Use a stable chair, stand with control, then sit back slowly.","vi":"Dùng ghế vững, đứng lên có kiểm soát rồi ngồi xuống từ từ."}','{"en":"Use your hands on the chair or reduce the range.","vi":"Dùng tay hỗ trợ trên ghế hoặc giảm biên độ."}','{"en":"Pause before sitting or hold a light weight after clearance.","vi":"Dừng trước khi ngồi hoặc cầm tạ nhẹ sau khi được cho phép."}','["treadmill-walk"]','starter-1',1788028698053,1788028698053),
('wall-push-up','{"en":"Wall push-up","vi":"Chống đẩy tường"}','strength','["wall"]','["chest","shoulders","arms"]','["wrist_pain","shoulder_pain"]','{"en":"Keep your body long, lower toward the wall, then press away without holding your breath.","vi":"Giữ cơ thể thẳng, hạ người về phía tường rồi đẩy ra, không nín thở."}','{"en":"Stand closer to the wall.","vi":"Đứng gần tường hơn."}','{"en":"Move your feet farther back only when the movement stays pain-free.","vi":"Chỉ lùi chân xa hơn khi động tác vẫn không đau."}','["band-row"]','starter-1',1788028698053,1788028698053),
('bicycle-easy','{"en":"Easy bicycle ride","vi":"Đạp xe nhẹ"}','aerobic','["bicycle"]','["cardiovascular","legs"]','["balance_risk","knee_pain"]','{"en":"Ride at a pace where you can still speak in full sentences.","vi":"Đạp ở mức vẫn có thể nói trọn câu."}','{"en":"Use a shorter, flatter route or a stationary bicycle.","vi":"Chọn lộ trình ngắn, bằng phẳng hơn hoặc xe đạp tại chỗ."}','{"en":"Add five minutes only at a scheduled check-in after good recovery.","vi":"Chỉ thêm năm phút ở lần đánh giá định kỳ sau khi hồi phục tốt."}','["treadmill-walk"]','starter-1',1788028698053,1788028698053),
('treadmill-walk','{"en":"Mini treadmill walk","vi":"Đi bộ máy chạy mini"}','aerobic','["mini treadmill"]','["cardiovascular","legs"]','["balance_risk","knee_pain"]','{"en":"Start flat, hold the rail if needed, and choose a comfortable walking pace.","vi":"Bắt đầu ở mặt phẳng, giữ tay vịn khi cần và đi với tốc độ thoải mái."}','{"en":"Walk beside the treadmill or use shorter intervals.","vi":"Đi bộ bên ngoài máy hoặc dùng các khoảng ngắn hơn."}','{"en":"Increase time before speed, only at a scheduled check-in.","vi":"Tăng thời gian trước tốc độ, chỉ tại lần đánh giá định kỳ."}','["bicycle-easy"]','starter-1',1788028698053,1788028698053),
('band-row','{"en":"Resistance-band row","vi":"Kéo dây kháng lực"}','strength','["resistance band","anchor"]','["back","arms"]','["shoulder_pain"]','{"en":"Anchor the band securely, pull elbows toward your sides, then return slowly.","vi":"Cố định dây an toàn, kéo khuỷu tay về hai bên rồi trả chậm."}','{"en":"Use a lighter band or shorten the range.","vi":"Dùng dây nhẹ hơn hoặc rút ngắn biên độ."}','{"en":"Add repetitions only when technique and recovery stay comfortable.","vi":"Chỉ tăng số lần khi kỹ thuật và hồi phục vẫn thoải mái."}','["wall-push-up"]','starter-1',1788028698053,1788028698053);
