import { StatusCodes } from "http-status-codes";
import Orangtua from '../models/OrangtuaModel.js'
import qrcode from 'qrcode';
import OrangtuaModel from "../models/OrangtuaModel.js";
import path from 'path';
import XLSX from 'xlsx';
// import PDFDocument from 'pdfkit';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PRODI } from "../utils/constants.js";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import MejaRegistrasiModel from "../models/MejaRegistrasiModel.js";


export const getAllOrangtua = async (req, res) => {
    const { search, jurusan, prodi, isRegis, isKonsum, sort } = req.query;

    let queryObject = {
        isRegis: false,
        isDeleted: false
    };

    if (search) {
        queryObject = {
            $or: [
                { nim: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } },
                { noIjazah: { $regex: search, $options: 'i' } },
                { jurusan: { $regex: search, $options: 'i' } },
                { prodi: { $regex: search, $options: 'i' } },
                { noKursi: { $regex: search, $options: 'i' } },
            ]
        }
    }

    if (isRegis && isRegis == "true") {
        queryObject.isRegis = true;
    }
    if (jurusan && jurusan !== 'all') {
        queryObject.jurusan = jurusan;
    }
    if (prodi && prodi !== 'all') {
        queryObject.prodi = prodi;
    }
    const sortOptions = {
        newest: '-createdAt',
        oldest: 'createdAt',
        'a-z': 'name',
        'z-a': '-name',
        'No Kursi - ASC': 'noKursi',
        'No Kursi - DESC': '-noKursi',
        NoKursiASC: 'noKursi',
    };
    const sortKey = sortOptions[sort] || sortOptions.NoKursiASC;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    //option untuk qr code
    const opts = {
        errorCorrectionLevel: "H",
        type: "image/jpeg",
        quality: 0.3,
        margin: 1.2,
        color: {
            dark: "#000",
            light: "#FFFF",
        },
        width: 250,
    };


    try {
        const orangtuas = await Orangtua.find(queryObject)
            .sort(sortKey)
            .skip(skip)
            .limit(limit);

        const orangtuasWithNumber = orangtuas.map((orangtua, index) => ({
            ...orangtua.toObject(),
            number: skip + index + 1
        }));

        const orangtuasWithQRCodes = await Promise.all(orangtuas.map(async (orangtua, index) => {
            const src = await qrcode.toDataURL(orangtua._id.toString(), opts);
            return {
                ...orangtua.toObject(),
                number: skip + index + 1,
                qr_code: src
            };
        }));

        const totalOrangtuas = await Orangtua.countDocuments(queryObject);
        const numOfPages = Math.ceil(totalOrangtuas / limit);

        res.status(StatusCodes.OK).json({ total: totalOrangtuas, numOfPages, currentPage: page, data: orangtuasWithQRCodes, qrcode: orangtuasWithQRCodes })

    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
}

export const createOrangtua = async (req, res) => {
    try {
        req.body.createdBy = req.user.userId;
        const orangtua = await Orangtua.create(req.body);
        res.status(StatusCodes.CREATED).json({ orangtua });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
}

export const getOrangtua = async (req, res) => {
    try {
        const orangtua = await Orangtua.findById(req.params.id)
        res.status(StatusCodes.OK).json({ orangtua })
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
}

export const updateOrangtua = async (req, res) => {
    try {
        req.body.updatedBy = req.user.userId;
        const updatedOrangtua = await Orangtua.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.status(StatusCodes.OK).json({ msg: 'Orangtua modified', orangtua: updatedOrangtua });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
}

export const updateOrangtuaKonsumsi = async (req, res) => {
    try {
        if (req.enabledFeatures.Konsumsi) {
            let isKonsumsi = true;
            const konsumsiOrangtua = await Orangtua.findById(req.params.id);
            if (konsumsiOrangtua.isKonsumsi) {
                isKonsumsi = false;
            }
    
            const updatedOrangtua = await Orangtua.findByIdAndUpdate(req.params.id, { isKonsumsi: isKonsumsi, isKonsumsiBy: req.user.userId }, {
                new: true,
            });
            res.status(StatusCodes.OK).json({ msg: 'Orangtua Konsumsied modified', orangtua: updatedOrangtua });
        }else{
            res.status(StatusCodes.NOT_ACCEPTABLE).json({ message: "Pengambilan Konsumsi ditutup!" });
        }
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
};

export const updateOrangtuaRegister = async (req, res) => {
    try {

        if (!req.enabledFeatures.Registrasi) {
            return res.status(StatusCodes.NOT_ACCEPTABLE).json({ message: "Registrasi ditutup!" });
        }
        let isRegis = true;
        const protocolLength = req.headers.referer.startsWith("https://") ? 8 : 7;
        const urlAfterProtocol = req.headers.referer.substring(protocolLength);

        if (urlAfterProtocol.includes("isRegis=true")) {
            isRegis = false;
        }

        const mejaId = req.params.mejaId;
        const getPintu = await MejaRegistrasiModel.findById(mejaId);

        if (!getPintu) {
            return res.status(404).json({ message: "Meja tidak ditemukan." });
        }

        const orangtua = await Orangtua.findById(req.params.id);

        if (!orangtua) {
            return res.status(404).json({ message: "Orangtua tidak ditemukan." });
        }

        let setPintu = orangtua.noKursi;

        // Jika noKursi belum di-set, set nomor baru
        if (!orangtua.noKursi && orangtua.isRegis == false) {
            if (getPintu.kuota > 0) {
                // Cari semua nomor kursi yang sudah di-assign dengan kode meja yang sama (tanpa sorting dari MongoDB)
                const noKursiOrangtua = await Orangtua.find({
                    noKursi: { $regex: `^${getPintu.code}` },
                });

                // Sorting hasil query di sisi JavaScript berdasarkan bagian numerik
                const sortedNoKursiOrangtua = noKursiOrangtua.sort((a, b) => {
                    const aNum = parseInt(a.noKursi.slice(getPintu.code.length), 10);
                    const bNum = parseInt(b.noKursi.slice(getPintu.code.length), 10);
                    return bNum - aNum;
                });
// console.log(sortedNoKursiOrangtua);

//                 return 
                // Jika ada nomor kursi terakhir, tambah 1 untuk mendapatkan nomor baru
                if (sortedNoKursiOrangtua.length > 0) {
                    let nomorTerakhir = sortedNoKursiOrangtua[0].noKursi.slice(getPintu.code.length); // Ambil bagian nomor saja
                    setPintu = `${getPintu.code}${parseInt(nomorTerakhir, 10) + 1}`;
                } else {
                    setPintu = `${getPintu.code}1`; // Jika belum ada kursi, mulai dari 1
                }


                // Kurangi kuota meja yang dipilih
                await MejaRegistrasiModel.findByIdAndUpdate(
                    mejaId,
                    { $inc: { kuota: -1 } },
                    { new: true }
                );
            } else {
                // Jika kuota meja penuh, cari meja lain yang masih ada kuota
                const getAllPintu = await MejaRegistrasiModel.find({
                    kuota: { $gt: 0 },
                })
                    .sort({ code: 1 })
                    .limit(1);

                if (getAllPintu.length > 0) {
                    const noKursiOrangtuaBaru = await Orangtua.find({
                        noKursi: { $regex: `^${getAllPintu[0].code}` },
                    });

                    // Sorting berdasarkan bagian numerik
                    const sortedNoKursiOrangtuaBaru = noKursiOrangtuaBaru.sort((a, b) => {
                        const aNum = parseInt(a.noKursi.slice(getAllPintu[0].code.length), 10);
                        const bNum = parseInt(b.noKursi.slice(getAllPintu[0].code.length), 10);
                        return bNum - aNum;
                    });

                    if (sortedNoKursiOrangtuaBaru.length > 0) {
                        let nomorTerakhirBaru = sortedNoKursiOrangtuaBaru[0].noKursi.slice(getAllPintu[0].code.length);
                        setPintu = `${getAllPintu[0].code}${parseInt(nomorTerakhirBaru, 10) + 1}`;
                    } else {
                        setPintu = `${getAllPintu[0].code}1`;
                    }

                    // Update kuota di meja baru
                    await MejaRegistrasiModel.findByIdAndUpdate(getAllPintu[0]._id, {
                        $inc: { kuota: -1 },
                    });
                } else {
                    return res.status(400).json({ message: "Semua meja sudah penuh." });
                }
            }
        }

        // Update data orangtua dengan noKursi yang sudah di-set
        const updatedOrangtua = await Orangtua.findByIdAndUpdate(
            req.params.id,
            {
                isRegis: isRegis,
                noKursi: setPintu,
                isRegisBy: req.user.userId,
            },
            { new: true }
        );

        res.status(StatusCodes.OK).json({ msg: 'Orangtua Registered modified', orangtua: updatedOrangtua });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
};

export const deleteOrangtua = async (req, res) => {
    try {
        const { id } = req.params
        const orangtua = await Orangtua.findByIdAndDelete(id)
        res.status(StatusCodes.OK).json({ msg: 'Orangtua deleted', orangtua })
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
}

export const getExportOrtu = async (req, res) => {
    let queryObject = {
        isRegis: false,
        isDeleted: false
    };
    //option untuk qr code
    const opts = {
        errorCorrectionLevel: "H",
        type: "image/jpeg",
        quality: 0.3,
        margin: 1.2,
        color: {
            dark: "#000",
            light: "#FFFF",
        },
        width: 240,
    };

    try {
        const orangtua = await Orangtua.find(queryObject);
        const orangtuaWithQRCodes = await Promise.all(orangtua.map(async (orangtua, index) => {
            const src = await qrcode.toDataURL(orangtua._id.toString(), opts);
            return {
                ...orangtua.toObject(),
                number: index + 1,
                qr_code: src
            };
        }));

        const totalOrangtuas = await Orangtua.countDocuments(queryObject);
        return { total: totalOrangtuas, data: orangtuaWithQRCodes };
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
};

export const showStats = async (req, res) => {
    try {

        const dataOrangTua = await Orangtua.find({ isDeleted: false });
        const totalOrangTuaRegistered = await Orangtua.countDocuments({ isRegis: true, isDeleted: false });
        const totalOrangTuaUnregistered = await Orangtua.countDocuments({ isRegis: false, isDeleted: false });



        let Registered = {};
        let UnRegistered = {};
        let data = []
        let obj = {}
        // Inisialisasi semua prodi dengan nilai 0 di Registered dan UnRegistered
        Object.values(PRODI).forEach((prodi) => {
            Registered[prodi] = 0;
            UnRegistered[prodi] = 0;
        });

        // Iterasi melalui data mahasiswa yang sudah terdaftar
        dataOrangTua.forEach((orangtua) => {
            if (Object.values(PRODI).includes(orangtua.prodi) && orangtua.isRegis) {
                // Tambahkan jika orangtua terdaftar pada prodi tersebut
                Registered[orangtua.prodi] += 1;
            } else if (Object.values(PRODI).includes(orangtua.prodi) && !orangtua.isRegis) {
                UnRegistered[orangtua.prodi] += 1;
            }
        });

        // console.log(UnRegistered);
        Object.values(PRODI).forEach((prodi) => {
            obj = {
                name: prodi,
                registered: Registered[prodi],
                unregistered: UnRegistered[prodi]
            }

            data.push(obj)
        })

        const graphData = data

        const defaultStats =
        {
            ALL: {
                REGISTERED: totalOrangTuaRegistered || 0,
                UNREGISTERED: totalOrangTuaUnregistered || 0,
            },
            // JTI: {
            //     REGISTERED: statsByJurusanRegisteredObj.JTI || 0,
            //     UNREGISTERED: statsByJurusanUnregisteredObj.JTI || 0
            // },
            // JTIN: {
            //     REGISTERED: statsByJurusanRegisteredObj.JTIN || 0,
            //     UNREGISTERED: statsByJurusanUnregisteredObj.JTIN || 0
            // },

            // AKTP: {
            //     REGISTERED: statsByJurusanRegisteredObj.AKTP || 0,
            //     UNREGISTERED: statsByJurusanUnregisteredObj.AKTP || 0,
            // }
        };

        res.status(StatusCodes.OK).json({ defaultStats, graphData });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
};

export const importDataOrtu = async (req, res) => {
    try {
        const filePath = path.join(process.cwd(), req.file.path);
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        let cleanData = {};
        data.forEach(async (item) => {
            let prodi = item.Program_Studi.replace("-", "")
                // .replace(/\s+/g, " ")
                .trim()
                .toUpperCase();
            let nama = item.Nama.toUpperCase();

            const orangtua = new OrangtuaModel({
                name: nama,
                prodi: prodi,
                noKursi: item.No_Kursi,
            });
            try {
                await orangtua.save();
                console.log(`Data orangtua ${orangtua.name} berhasil disimpan.`);
            } catch (error) {
                console.error(`Gagal menyimpan data orangtua: ${error.message}`);
            }
        });


        // for (const item of data) {
        //     const inputSeatNumber = item.No_kursi;
        //     let formattedSeatNumber;
        //     if (inputSeatNumber && inputSeatNumber.includes('.')) {
        //         const [letterPart, numberPart] = inputSeatNumber.split('.');
        //         const formattedNumberPart = String(numberPart).padStart(3, '0');
        //         formattedSeatNumber = letterPart + '.' + formattedNumberPart;
        //     } else {
        //         console.error('Nomor kursi tidak valid.');
        //         continue; // Lewati item ini jika nomor kursi tidak valid
        //     }

        //     const orangtua = new OrangtuaModel({
        //         nim: item.NIM,
        //         name: item.Nama,
        //         nik: item.NIK,
        //         noIjazah: item.Nomor_Ijazah,
        //         prodi: item.Program_Studi,
        //         jurusan: item.Jurusan,
        //         ipk: item.IPK,
        //         noKursi: formattedSeatNumber
        //     });

        //     try {
        //         await orangtua.save();
        //         console.log(`Data orangtua ${orangtua.name} berhasil disimpan.`);
        //     } catch (error) {
        //         console.error(`Gagal menyimpan data orangtua: ${error.message}`);
        //     }
        // }

        res.status(StatusCodes.OK).json({ data: "Berhasil mengimport data" });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
};


export const exportPdfDataOrtu = async (req, res) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Ambil data tamu
    const { data } = await getExportOrtu(req, res);

    // Konversi cm ke pt (1 cm = 28.35 pt)
    const cmToPt = (cm) => cm * 28.35;

    // Ukuran halaman custom
    const pageWidth = cmToPt(20.4); // Lebar halaman custom
    const pageHeight = cmToPt(16.5); // Tinggi halaman custom

    // Pengaturan ukuran dan jarak label
    const labelWidth = cmToPt(6.4); // Lebar label
    const labelHeight = cmToPt(3.2); // Tinggi label
    const horizontalPitch = cmToPt(6.8); // Jarak horizontal antar label
    const verticalPitch = cmToPt(3.8); // Jarak vertikal antar label
    const topMargin = cmToPt(0.9); // Margin atas
    const sideMargin = cmToPt(0.2); // Margin samping

    // Buat dokumen PDF baru
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 10;
    const maxWidthForText = labelWidth - 70; // Ruang untuk teks sebelum mencapai batas label

    let x = sideMargin;
    let y = pageHeight - topMargin - labelHeight; // Awal di margin atas

    let page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Fungsi untuk memecah teks menjadi beberapa baris jika terlalu panjang
    const splitTextToLines = (text, maxWidth, fontSize, font) => {
        const words = text.split(" ");
        let lines = [];
        let currentLine = "";

        for (const word of words) {
            const lineWithWord = currentLine ? `${currentLine} ${word}` : word;
            const textWidth = font.widthOfTextAtSize(lineWithWord, fontSize);

            if (textWidth <= maxWidth) {
                currentLine = lineWithWord;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }

        lines.push(currentLine); // Masukkan sisa kata ke dalam baris terakhir
        return lines;
    };

    for (const t of data) {
        // Ambil QR code dari base64
        const qrCodeData = t.qr_code.split(",")[1];
        const qrImage = await pdfDoc.embedPng(Buffer.from(qrCodeData, "base64"));

        // Tambah QR code di sebelah kiri nama
        page.drawImage(qrImage, {
            x: x + 10, // Posisi QR di sebelah kiri label
            y: y + labelHeight / 2 - 25, // Tengah label secara vertikal
            width: 50,
            height: 50,
        });

        // Jika nama tamu terlalu panjang, pecah jadi beberapa baris
        const lines = splitTextToLines(t.name, maxWidthForText, fontSize, font);

        let textY = y + labelHeight / 2 + (lines.length - 1) * 5; // 10 Penyesuaian agar teks berada di tengah label

        // Posisikan nama di sebelah kanan QR code
        for (const line of lines) {
            page.drawText(line, {
                x: x + 65, // Posisikan teks di sebelah kanan QR code
                y: textY, // Posisikan baris saat ini
                size: fontSize,
                font,
                color: rgb(0, 0, 0),
            });
            textY -= 15; // Geser ke bawah untuk baris berikutnya
        }

        // Geser ke posisi label berikutnya di horizontal
        x += horizontalPitch;

        // Jika sudah sampai di akhir baris (3 label per baris), pindah ke bawah (baris berikutnya)
        if (x + labelWidth > pageWidth - sideMargin) {
            x = sideMargin; // Reset ke awal
            y -= verticalPitch; // Pindah ke bawah
        }

        // Jika halaman sudah penuh (4 baris), buat halaman baru
        if (y < topMargin) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            x = sideMargin;
            y = pageHeight - topMargin - labelHeight;
        }
    }

    // Simpan PDF ke buffer
    const pdfBytes = await pdfDoc.save();

    // Kirim PDF sebagai response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=undangan.pdf");
    res.send(Buffer.from(pdfBytes));
};



// export const exportPdfDataOrtu = async (req, res) => {
//     const __filename = fileURLToPath(import.meta.url);
//     const __dirname = path.dirname(__filename);
//     try {
//         const { data } = await getExportOrtu(req, res);

//         const doc = new PDFDocument({ size: 'A4', margin: 50 });

//         // Menentukan path file PDF yang akan disimpan ke folder public
//         const filePath = path.join(__dirname, '../public/exports', 'orangtua.pdf');

//         // Buat stream untuk menyimpan file PDF
//         const writeStream = fs.createWriteStream(filePath);

//         // Piping PDF ke file
//         doc.pipe(writeStream);

//         // Isi konten PDF
//         doc.fontSize(12).text('Data Orangtua', { align: 'center' });

//         data.forEach((orangtua, i) => {
//             // Estimasi tinggi data dan QR code
//             const dataHeight = 100;

//             // Cek apakah ruang cukup di halaman saat ini
//             if (doc.y + dataHeight > doc.page.height - doc.page.margins.bottom) {
//                 doc.addPage();
//             }

//             doc.moveDown();
//             doc.fontSize(10)
//                 .text(`No: ${orangtua.number}`, 50)
//                 .text(`Nama: ${orangtua.name}`, 50)
//                 .text(`Prodi: ${orangtua.prodi}`, 50)
//                 .text(`No Kursi: ${orangtua.noKursi}`, 50, doc.y)
//             doc.image(orangtua.qr_code, doc.page.width - 150, doc.y - 54, {
//                 fit: [100, 100],
//                 align: 'right',
//                 valign: 'center'
//             });

//             doc.moveDown(4);
//             doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
//             // doc.moveDown(2);
//         });

//         // Selesaikan dokumen PDF
//         doc.end();

//         // Tunggu sampai proses penulisan selesai
//         writeStream.on('finish', () => {
//             console.log('PDF generated successfully!');
//             res.sendFile(filePath, (err) => {
//                 if (err) {
//                     console.error('Error sending file:', err);
//                     console.log(err);
//                 } else {

//                     fs.unlinkSync(filePath);
//                     console.log('PDF file deleted after sending.');
//                 }
//             })
//         });

//     } catch (error) {

//         res.status(500).json({ message: 'Error generating PDF', error: error.message });
//     }
// }

// export const exportPdfDataOrtu = async (req, res) => {
//     try {
//         const { data } = await getExportOrtu(req, res);

//         const doc = new PDFDocument({ size: 'A4', margin: 50 });

//         res.setHeader('Content-Disposition', 'attachment; filename=orangtua.pdf');
//         res.setHeader('Content-Type', 'application/pdf');

//         doc.pipe(res);

//         doc.fontSize(12).text('Data Orang Tua', { align: 'center' });

//         data.forEach((orangtua, i) => {
//             // Estimasi tinggi data dan QR code
//             const dataHeight = 100;

//             // Cek apakah ruang cukup di halaman saat ini
//             if (doc.y + dataHeight > doc.page.height - doc.page.margins.bottom) {
//                 doc.addPage();
//             }

//             doc.moveDown();
//             doc.fontSize(10)
//                 .text(`No: ${orangtua.number}`, 50)
//                 .text(`Nama: ${orangtua.name}`, 50)
//                 .text(`Prodi: ${orangtua.prodi}`, 50)
//                 .text(`No Kursi: ${orangtua.noKursi}`, 50, doc.y)
//             doc.image(orangtua.qr_code, doc.page.width - 150, doc.y - 54, {
//                 fit: [100, 100],
//                 align: 'right',
//                 valign: 'center'
//             });

//             doc.moveDown(4);
//         });

//         doc.end();
//     } catch (error) {
//         res.status(500).json({ message: 'Error generating PDF', error: error.message });
//     }
// }
