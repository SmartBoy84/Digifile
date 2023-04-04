package main

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Please supply path where the pdfs are stored!")
		return
	}

	targetPath := os.Args[1]

	pdfFiles, err := filepath.Glob(filepath.Join(targetPath, "*.pdf"))
	if err != nil {
		panic(err)
	}

	for _, pdfFile := range pdfFiles {
		oldName := filepath.Base(pdfFile)
		newName := strings.ReplaceAll(oldName, "$$", "/")
		newPath := filepath.Join(targetPath, newName)

		err := os.MkdirAll(filepath.Dir(newPath), os.ModePerm)
		if err != nil {
			panic(err)
		}

		err = os.Rename(pdfFile, newPath)
		if err != nil {
			panic(err)
		}
	}

	allFiles := make([]string, 0)
	filepath.Walk(os.Args[1], func(path string, info fs.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && strings.ToLower(filepath.Ext(path)) == ".pdf" {

			path = strings.TrimPrefix(path, targetPath)
			path = strings.TrimPrefix(path, "/")
			path = strings.TrimPrefix(path, `\`)
			path = "/" + path

			path = strings.ReplaceAll(path, "//", "/")
			path = strings.ReplaceAll(path, `\`, "$$")
			path = strings.ReplaceAll(path, "/", "$$")

			allFiles = append(allFiles, path)
		}
		return nil
	})

	file, err := os.OpenFile("target.txt", os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		panic(err)
	}
	defer output.Close()

	encoder := json.NewEncoder(output)
	encoder.SetEscapeHTML(false)

	encoder.SetEscapeHTML(false)

	if err := encoder.Encode(allFiles); err != nil {
		fmt.Println("Failed to encode to JSON:", err)
		return
	}
}
