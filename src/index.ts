import * as puppeteer from "puppeteer-core";
import * as fs from "fs-extra";
import * as https from "https";
import { PDFDocument } from "pdf-lib";
import * as path from "path";
import * as _ from "lodash";

import * as chalk from "chalk";
import clear = require("clear");
import * as figlet from "figlet";

import * as os from "os";

const download = require("download-chromium");

import { askGithubCredentials } from "./inquirer";

class Pupet {
  constructor(
    private readonly browser: puppeteer.Browser,
    private readonly url: string
  ) {}

  public get puppeteer() {
    return this.browser;
  }

  public async getTitle(): Promise<string> {
    try {
      const page = await this.puppeteer.newPage();
      await page.goto(this.url);
      const title = await page.evaluate(() => {
        return document.getElementById("book_banner_title").innerText;
      });
      return title;
    } catch (e) {
      throw new Error(e);
    }
  }

  public async getPdfLinks() {
    try {
      const page = await this.puppeteer.newPage();
      await page.goto(this.url);
      // a.getElementsByClassName("card_text")[0].getElementsByTagName('a')[0].href
      const links = await page.evaluate(() => {
        const links = Array.from(
          document
            .getElementById("available_items_list_text")
            .getElementsByClassName("card_text")
        );
        return links.map((i) => i.getElementsByTagName("a")[1].href);
      });
      return links;
    } catch (e) {
      throw new Error(e);
    }
  }

  public async sortByFileName() {
    try {
      const fileNames = await fs.readdir(path.join(process.cwd(), "tmp"));
      return fileNames.sort(
        (a, b) => Number(a.split(".")[0]) - Number(b.split(".")[0])
      );
    } catch (e) {
      throw new Error(e);
    }
  }
}

class PupetBuilder {
  static async build(url: string, executablePath?: string): Promise<Pupet> {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
    });
    return new Pupet(browser, url);
  }
}

(async () => {
  clear();

  try {
    console.log(
      chalk.yellow(figlet.textSync("MUSE Rip", { horizontalLayout: "full" }))
    );
    await fs.ensureDir(path.join(process.cwd(), "tmp"));

    const executable = await download({
      revision: 722234,
      installPath: `${os.tmpdir()}/.local-chromium`,
    });

    console.log("TEMP", executable);

    const creds = await askGithubCredentials();

    const p = await PupetBuilder.build(creds.url as string, executable);

    const t = await p.getTitle();
    const l = await p.getPdfLinks();

    const np = await p.puppeteer.newPage();

    np.on("request", (req) => {
      const reqUrlParts = req.url().split("/");
      const fileName = `${reqUrlParts[reqUrlParts.length - 2]}.${
        reqUrlParts[reqUrlParts.length - 1]
      }`;
      const file = fs.createWriteStream(
        path.join(process.cwd(), "tmp", fileName)
      );
      https.get(req.url(), (response) => response.pipe(file));
    });

    for (const link of l) {
      await np.goto(link).catch((e) => null);
    }

    const mergedPdf = await PDFDocument.create();

    const sortedFileNames = await p.sortByFileName();

    const blanks: number[] = [];
    for (const fileName of sortedFileNames) {
      const pdfBytes = fs.readFileSync(
        path.join(process.cwd(), "tmp", fileName)
      );

      const pdf = await PDFDocument.load(pdfBytes);

      blanks.push(pdf.getPageCount());

      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

      copiedPages.forEach((page) => {
        mergedPdf.addPage(page);
      });
    }

    let tmpP = mergedPdf.getPageCount();
    for (let i = blanks.length - 1; i >= 0; i--) {
      tmpP -= blanks[i];
      mergedPdf.removePage(tmpP);
    }

    mergedPdf.setTitle(t);

    const mergedPdfFile = await mergedPdf.save();

    await fs.writeFile(`${t}.pdf`, mergedPdfFile);

    await p.puppeteer.close();

    await fs.remove(path.join(process.cwd(), "tmp"));
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
})();
